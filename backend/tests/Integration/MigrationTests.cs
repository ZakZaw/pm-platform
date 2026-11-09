using Infrastructure.Persistence;
using Integration.Infrastructure;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql;

namespace Integration;

/// <summary>
/// The v1 security migrations (M3 refresh-token families, M4 share-link
/// lockout, M8 task-key counter) against real Postgres: a fresh database,
/// and a database that already holds rows when they are applied.
/// </summary>
[Collection(ApiCollection.Name)]
public class MigrationTests(ApiFixture fx)
{
    private const string LastPreSecurityMigration = "20260528235039_F2_25_IntegrationHealth";

    private static AppDbContext Context(string cs) =>
        new(new DbContextOptionsBuilder<AppDbContext>().UseNpgsql(cs).Options);

    [Fact]
    public async Task Fresh_database_applies_every_migration()
    {
        var cs = await fx.Server.CreateDatabaseAsync("pmp_mig_fresh");
        await using var db = Context(cs);

        await db.Database.MigrateAsync();

        var all = db.Database.GetMigrations().ToList();
        var applied = (await db.Database.GetAppliedMigrationsAsync()).ToList();
        Assert.Equal(all, applied);
        Assert.Contains(applied, m => m.EndsWith("_M3_RefreshTokenFamilies"));
        Assert.Contains(applied, m => m.EndsWith("_M4_ShareLinkPasswordLockout"));
        Assert.Contains(applied, m => m.EndsWith("_M8_ProjectTaskKeyCounter"));
        Assert.Empty(await db.Database.GetPendingMigrationsAsync());
        Assert.False(db.Database.HasPendingModelChanges());
    }

    [Fact]
    public async Task Security_migrations_backfill_existing_rows_and_roll_back()
    {
        var cs = await fx.Server.CreateDatabaseAsync("pmp_mig_seeded");
        await using var db = Context(cs);
        var migrator = db.GetService<IMigrator>();

        await migrator.MigrateAsync(LastPreSecurityMigration);
        await ExecAsync(cs, """
            INSERT INTO users ("Id","Email","PasswordHash","FullName","CreatedAt")
              VALUES ('11111111-1111-1111-1111-111111111111','seed@example.test','x','Seed',now());
            INSERT INTO organizations ("Id","Name","Slug","Plan","SsoEnabled","CreatedAt")
              VALUES ('22222222-2222-2222-2222-222222222222','Seed Org','seed-org','Free',false,now());
            INSERT INTO projects ("Id","OrganizationId","Name","Slug","Type","Status","AIControlMode","CreatedBy","CreatedAt","Key") VALUES
              ('33333333-3333-3333-3333-333333333331','22222222-2222-2222-2222-222222222222','Alpha','alpha','Engineering','Active','Suggest','11111111-1111-1111-1111-111111111111',now(),'AL'),
              ('33333333-3333-3333-3333-333333333332','22222222-2222-2222-2222-222222222222','Beta','beta','Engineering','Active','Suggest','11111111-1111-1111-1111-111111111111',now(),'BE');
            INSERT INTO tasks ("Id","ProjectId","Title","Status","Priority","TimeLoggedMinutes","CreatedByAi","CreatedAt","KeyNum") VALUES
              (gen_random_uuid(),'33333333-3333-3333-3333-333333333331','t1','Backlog','Medium',0,false,now(),1),
              (gen_random_uuid(),'33333333-3333-3333-3333-333333333331','t2','Backlog','Medium',0,false,now(),2),
              (gen_random_uuid(),'33333333-3333-3333-3333-333333333331','t7','Done','Medium',0,false,now(),7);
            INSERT INTO refresh_tokens ("Id","UserId","TokenHash","ExpiresAt","CreatedAt","RevokedAt") VALUES
              ('44444444-4444-4444-4444-444444444441','11111111-1111-1111-1111-111111111111','h1',now()+interval '1 day',now(),NULL),
              ('44444444-4444-4444-4444-444444444442','11111111-1111-1111-1111-111111111111','h2',now()+interval '1 day',now(),now());
            INSERT INTO roadmap_share_links ("Id","ProjectId","Token","HideInternalLabels","HideAssignees","CreatedByUserId","CreatedAt")
              VALUES (gen_random_uuid(),'33333333-3333-3333-3333-333333333331','tok',false,false,'11111111-1111-1111-1111-111111111111',now());
            """);

        await migrator.MigrateAsync();

        // M8: counters start at each project's highest existing key (gaps kept).
        Assert.Equal(7, await ScalarAsync<int>(cs, """SELECT "LastTaskKeyNum" FROM projects WHERE "Key"='AL'"""));
        Assert.Equal(0, await ScalarAsync<int>(cs, """SELECT "LastTaskKeyNum" FROM projects WHERE "Key"='BE'"""));
        // M3: every pre-existing token becomes its own family; revocation state untouched.
        Assert.Equal(0L, await ScalarAsync<long>(cs, """SELECT count(*) FROM refresh_tokens WHERE "FamilyId" <> "Id" """));
        Assert.Equal(1L, await ScalarAsync<long>(cs, """SELECT count(*) FROM refresh_tokens WHERE "RevokedAt" IS NOT NULL"""));
        // M4: existing links start unlocked.
        Assert.Equal(0, await ScalarAsync<int>(cs, """SELECT "FailedPasswordAttempts" FROM roadmap_share_links"""));
        Assert.True(await ScalarAsync<bool>(cs, """SELECT "PasswordLockedUntil" IS NULL FROM roadmap_share_links"""));

        // The next key the app hands out continues after the backfilled max.
        Assert.Equal(8, await db.ReserveTaskKeyNumsAsync(Guid.Parse("33333333-3333-3333-3333-333333333331"), 1));
        Assert.Equal(1, await db.ReserveTaskKeyNumsAsync(Guid.Parse("33333333-3333-3333-3333-333333333332"), 1));

        // Down() works and keeps the data that predates the migrations.
        await migrator.MigrateAsync(LastPreSecurityMigration);
        Assert.Equal(0L, await ScalarAsync<long>(cs,
            """SELECT count(*) FROM information_schema.columns WHERE column_name IN ('FamilyId','LastTaskKeyNum','FailedPasswordAttempts','PasswordLockedUntil')"""));
        Assert.Equal(3L, await ScalarAsync<long>(cs, "SELECT count(*) FROM tasks"));
        Assert.Equal(2L, await ScalarAsync<long>(cs, "SELECT count(*) FROM refresh_tokens"));
    }

    private static async Task ExecAsync(string cs, string sql)
    {
        await using var conn = new NpgsqlConnection(cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        await cmd.ExecuteNonQueryAsync();
    }

    private static async Task<T> ScalarAsync<T>(string cs, string sql)
    {
        await using var conn = new NpgsqlConnection(cs);
        await conn.OpenAsync();
        await using var cmd = new NpgsqlCommand(sql, conn);
        return (T)(await cmd.ExecuteScalarAsync())!;
    }
}
