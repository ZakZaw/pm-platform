namespace Domain.Entities;

/// <summary>
/// A "this epic cannot start until that one finishes" edge. Cycle prevention
/// lives in the command handler (it needs DB access to walk the existing
/// graph); see <see cref="EpicDependencyGraph.WouldCreateCycle"/>.
/// </summary>
public class EpicDependency
{
    public Guid Id { get; set; } = Guid.NewGuid();

    /// <summary>The epic that has a prerequisite.</summary>
    public Guid EpicId { get; set; }

    /// <summary>The epic that must finish first.</summary>
    public Guid DependsOnEpicId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Epic Epic { get; set; } = null!;
    public Epic DependsOnEpic { get; set; } = null!;
}

/// <summary>
/// Pure-function helpers for reasoning about an epic dependency graph. Kept
/// in Domain so unit tests don't need an in-memory DB.
/// </summary>
public static class EpicDependencyGraph
{
    /// <summary>
    /// Returns true if adding "<paramref name="epicId"/> depends on
    /// <paramref name="dependsOnEpicId"/>" to the supplied edge set would
    /// create a cycle. Self-loops also count as cycles.
    /// </summary>
    public static bool WouldCreateCycle(
        IReadOnlyCollection<(Guid From, Guid To)> existingEdges,
        Guid epicId,
        Guid dependsOnEpicId)
    {
        if (epicId == dependsOnEpicId) return true;

        // BFS forward from dependsOnEpicId following the existing edges.
        // If we reach epicId, the new edge would close a cycle.
        var adjacency = new Dictionary<Guid, List<Guid>>();
        foreach (var (from, to) in existingEdges)
        {
            if (!adjacency.TryGetValue(from, out var list))
                adjacency[from] = list = [];
            list.Add(to);
        }

        var seen = new HashSet<Guid> { dependsOnEpicId };
        var queue = new Queue<Guid>();
        queue.Enqueue(dependsOnEpicId);

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            if (!adjacency.TryGetValue(current, out var nexts)) continue;
            foreach (var next in nexts)
            {
                if (next == epicId) return true;
                if (seen.Add(next)) queue.Enqueue(next);
            }
        }
        return false;
    }
}
