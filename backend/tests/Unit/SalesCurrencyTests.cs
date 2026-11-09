using Application.Features.Analytics;

namespace Unit;

public class SalesCurrencyTests
{
    [Fact]
    public void ReportingCurrency_IsTheOneHoldingMostValue_OthersListed()
    {
        var (currency, others) = SalesFunnelCalculator.ReportingCurrency(
        [
            ("usd", 1_000m), ("EUR", 5_000m), ("USD", 500m), ("GBP", 10m),
        ]);

        Assert.Equal("EUR", currency);
        Assert.Equal(["GBP", "USD"], others);
    }

    [Fact]
    public void ReportingCurrency_DefaultsWhenEmpty_AndTreatsBlankAsDefault()
    {
        Assert.Equal("USD", SalesFunnelCalculator.ReportingCurrency([]).Currency);
        var (currency, others) = SalesFunnelCalculator.ReportingCurrency([(null, 10m), ("", 5m)]);
        Assert.Equal("USD", currency);
        Assert.Empty(others);
    }

    [Fact]
    public void IsIn_IsCaseAndWhitespaceInsensitive()
    {
        Assert.True(SalesFunnelCalculator.IsIn(" eur ", "EUR"));
        Assert.False(SalesFunnelCalculator.IsIn("USD", "EUR"));
    }
}