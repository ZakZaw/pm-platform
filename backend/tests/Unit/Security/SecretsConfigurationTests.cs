using Api.Configuration;
using Microsoft.Extensions.Configuration;

namespace Unit.Security;

public class SecretsConfigurationTests
{
    private const string StrongKey = "k3y-that-is-private-random-and-long-enough-for-hs256!";

    private static IConfiguration Config(params (string Key, string? Value)[] values) =>
        new ConfigurationBuilder()
            .AddInMemoryCollection(values.Select(v => new KeyValuePair<string, string?>(v.Key, v.Value)))
            .Build();

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("too-short")]
    [InlineData(SecretsConfiguration.CommittedDevSigningKey)]
    [InlineData(SecretsConfiguration.EnvExamplePlaceholder)]
    public void OutsideDevelopment_WeakOrPublicKeys_FailFast(string? key) =>
        Assert.Throws<InvalidOperationException>(() => SecretsConfiguration.ValidateSigningKey(key, isDevelopment: false));

    [Fact]
    public void OutsideDevelopment_StrongKey_IsAccepted() =>
        Assert.Equal(StrongKey, SecretsConfiguration.ValidateSigningKey(StrongKey, isDevelopment: false));

    [Fact]
    public void Development_AcceptsTheCommittedDevKey() =>
        Assert.Equal(SecretsConfiguration.CommittedDevSigningKey,
            SecretsConfiguration.ValidateSigningKey(SecretsConfiguration.CommittedDevSigningKey, isDevelopment: true));

    [Fact]
    public void Development_MissingKey_StillFails() =>
        Assert.Throws<InvalidOperationException>(() => SecretsConfiguration.ValidateSigningKey(null, isDevelopment: true));

    [Fact]
    public void Bridge_MapsJwtSecretAndDatabaseUrl()
    {
        var config = Config(("Jwt:SigningKey", "from-appsettings"));
        var env = new Dictionary<string, string?> { ["JWT_SECRET"] = StrongKey, ["DATABASE_URL"] = "Host=db;Database=pm" };

        SecretsConfiguration.BridgeEnvironment(config, isDevelopment: false, n => env.GetValueOrDefault(n));

        Assert.Equal(StrongKey, config["Jwt:SigningKey"]);
        Assert.Equal("Host=db;Database=pm", config["ConnectionStrings:DefaultConnection"]);
    }

    [Fact]
    public void Bridge_InDevelopment_IgnoresAShortSecret_KeepingTheDevKey()
    {
        var config = Config(("Jwt:SigningKey", SecretsConfiguration.CommittedDevSigningKey));
        SecretsConfiguration.BridgeEnvironment(config, isDevelopment: true, n => n == "JWT_SECRET" ? "short" : null);
        Assert.Equal(SecretsConfiguration.CommittedDevSigningKey, config["Jwt:SigningKey"]);
    }

    [Fact]
    public void Bridge_OutsideDevelopment_AppliesAShortSecret_SoValidationRejectsIt()
    {
        var config = Config(("Jwt:SigningKey", StrongKey));
        SecretsConfiguration.BridgeEnvironment(config, isDevelopment: false, n => n == "JWT_SECRET" ? "short" : null);
        Assert.Equal("short", config["Jwt:SigningKey"]);
    }

    [Fact]
    public void DatabaseUrl_InUrlForm_IsConverted()
    {
        var cs = SecretsConfiguration.ToNpgsqlConnectionString("postgres://pm%40user:p%3Ass@db.example.com:6543/pmdb?sslmode=require");
        Assert.Contains("Host=db.example.com", cs);
        Assert.Contains("Port=6543", cs);
        Assert.Contains("Database=pmdb", cs);
        Assert.Contains("Username=pm@user", cs);
        Assert.Contains("Password=p:ss", cs);
        Assert.Contains("SSL Mode=Require", cs);
    }
}