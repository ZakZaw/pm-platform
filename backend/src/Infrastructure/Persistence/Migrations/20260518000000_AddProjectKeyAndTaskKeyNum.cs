using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddProjectKeyAndTaskKeyNum : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1) Add nullable columns so existing rows survive.
            migrationBuilder.AddColumn<string>(
                name: "Key",
                table: "projects",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "KeyNum",
                table: "tasks",
                type: "integer",
                nullable: true);

            // 2) Back-fill: derive Project.Key from the first 2 letters of Name.
            //    Within an org, suffix duplicates with the row number ("AT", "AT2", ...).
            //    Personal projects (OrganizationId IS NULL) all get a unique key
            //    via their row_number — collisions there are rare since each
            //    user has one personal project.
            migrationBuilder.Sql(@"
                WITH ranked AS (
                    SELECT
                        ""Id"",
                        UPPER(LEFT(REGEXP_REPLACE(""Name"", '[^A-Za-z]', '', 'g'), 2)) AS base_key,
                        ROW_NUMBER() OVER (
                            PARTITION BY
                                COALESCE(""OrganizationId""::text, '__personal__'),
                                UPPER(LEFT(REGEXP_REPLACE(""Name"", '[^A-Za-z]', '', 'g'), 2))
                            ORDER BY ""CreatedAt""
                        ) AS rn
                    FROM projects
                )
                UPDATE projects p
                SET ""Key"" = CASE
                    WHEN r.base_key = '' THEN
                        CASE WHEN r.rn = 1 THEN 'PR' ELSE 'PR' || r.rn::text END
                    WHEN r.rn = 1 THEN r.base_key
                    ELSE r.base_key || r.rn::text
                END
                FROM ranked r
                WHERE p.""Id"" = r.""Id"";
            ");

            // 3) Back-fill Task.KeyNum: per project, rank tasks by CreatedAt
            //    then Id to break ties deterministically.
            migrationBuilder.Sql(@"
                WITH ranked AS (
                    SELECT
                        ""Id"",
                        ROW_NUMBER() OVER (
                            PARTITION BY ""ProjectId""
                            ORDER BY ""CreatedAt"", ""Id""
                        ) AS rn
                    FROM tasks
                )
                UPDATE tasks t
                SET ""KeyNum"" = r.rn
                FROM ranked r
                WHERE t.""Id"" = r.""Id"";
            ");

            // 4) Make columns NOT NULL now that data is populated.
            migrationBuilder.AlterColumn<string>(
                name: "Key",
                table: "projects",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(8)",
                oldMaxLength: 8,
                oldNullable: true);

            migrationBuilder.AlterColumn<int>(
                name: "KeyNum",
                table: "tasks",
                type: "integer",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "integer",
                oldNullable: true);

            // 5) Unique constraints.
            migrationBuilder.CreateIndex(
                name: "IX_projects_OrganizationId_Key",
                table: "projects",
                columns: new[] { "OrganizationId", "Key" },
                unique: true,
                filter: "\"OrganizationId\" IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_tasks_ProjectId_KeyNum",
                table: "tasks",
                columns: new[] { "ProjectId", "KeyNum" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_tasks_ProjectId_KeyNum",
                table: "tasks");

            migrationBuilder.DropIndex(
                name: "IX_projects_OrganizationId_Key",
                table: "projects");

            migrationBuilder.DropColumn(
                name: "KeyNum",
                table: "tasks");

            migrationBuilder.DropColumn(
                name: "Key",
                table: "projects");
        }
    }
}
