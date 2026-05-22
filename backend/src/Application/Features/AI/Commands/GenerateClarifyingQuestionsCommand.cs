using Application.Common;
using Application.Interfaces;
using MediatR;

namespace Application.Features.AI.Commands;

public record GenerateClarifyingQuestionsCommand(string Description, string Type)
    : IRequest<Result<IReadOnlyList<string>>>;

public class GenerateClarifyingQuestionsCommandHandler(IAIService ai)
    : IRequestHandler<GenerateClarifyingQuestionsCommand, Result<IReadOnlyList<string>>>
{
    public async Task<Result<IReadOnlyList<string>>> Handle(
        GenerateClarifyingQuestionsCommand request, CancellationToken ct)
    {
        var description = (request.Description ?? string.Empty).Trim();
        if (description.Length is < 10 or > 2000)
            return Result.Failure<IReadOnlyList<string>>(AIErrors.InvalidDescription);

        if (!ai.IsConfigured)
            return Result.Failure<IReadOnlyList<string>>(AIErrors.NotConfigured);

        try
        {
            var qs = await ai.GenerateClarifyingQuestionsAsync(
                description, request.Type ?? "Engineering", ct);
            return Result.Success(qs);
        }
        catch
        {
            return Result.Failure<IReadOnlyList<string>>(AIErrors.ProviderFailed);
        }
    }
}
