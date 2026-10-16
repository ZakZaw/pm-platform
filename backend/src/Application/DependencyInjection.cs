using System.Reflection;
using FluentValidation;
using Microsoft.Extensions.DependencyInjection;

namespace Application;

public static class DependencyInjection
{
    /// <param name="luckyPennyLicenseKey">
    /// MediatR 14 / AutoMapper 16 are commercially licensed (Lucky Penny Software).
    /// Without a key they still run but log a licence warning; production use
    /// requires one (the free Community licence covers small companies).
    /// </param>
    public static IServiceCollection AddApplication(this IServiceCollection services, string? luckyPennyLicenseKey = null)
    {
        var assembly = Assembly.GetExecutingAssembly();
        services.AddMediatR(cfg =>
        {
            cfg.LicenseKey = luckyPennyLicenseKey;
            cfg.RegisterServicesFromAssembly(assembly);
            // M1 - validators were registered but never invoked.
            cfg.AddOpenBehavior(typeof(Common.Behaviors.ValidationBehavior<,>));
        });
        services.AddValidatorsFromAssembly(assembly);
        services.AddAutoMapper(cfg => { cfg.LicenseKey = luckyPennyLicenseKey; }, assembly);
        services.AddScoped<Authorization.IAccessControl, Authorization.AccessControl>();
        return services;
    }
}
