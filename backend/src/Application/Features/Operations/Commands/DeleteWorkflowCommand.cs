using Application.Common;
using Application.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Application.Features.Operations.Commands;

public record DeleteWorkflowCommand(Guid WorkflowId) : IRequest<Result>;

public class DeleteWorkflowCommandHandler(IAppDbContext db)
    : IRequestHandler<DeleteWorkflowCommand, Result>
{
    public async Task<Result> Handle(DeleteWorkflowCommand request, CancellationToken ct)
    {
        var w = await db.Workflows.FirstOrDefaultAsync(x => x.Id == request.WorkflowId, ct);
        if (w is null) return Result.Failure(OperationsErrors.WorkflowNotFound);

        db.Workflows.Remove(w);
        await db.SaveChangesAsync(ct);
        return Result.Success();
    }
}
