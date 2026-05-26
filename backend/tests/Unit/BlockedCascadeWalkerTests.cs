using Application.Features.Tasks.Notifications;

namespace Unit;

public class BlockedCascadeWalkerTests
{
    private static readonly Guid A = Guid.NewGuid();
    private static readonly Guid B = Guid.NewGuid();
    private static readonly Guid C = Guid.NewGuid();
    private static readonly Guid D = Guid.NewGuid();
    private static readonly Guid E = Guid.NewGuid();

    [Fact]
    public void EmptyGraph_ReturnsEmpty()
    {
        var result = BlockedCascadeWalker.ForwardClosure([], A);
        Assert.Empty(result);
    }

    [Fact]
    public void NoOutboundEdges_ReturnsEmpty()
    {
        // B depends on A, but if the root we're querying is unrelated
        // there's nothing downstream of it.
        var edges = new List<(Guid, Guid)> { (B, A) };
        var result = BlockedCascadeWalker.ForwardClosure(edges, C);
        Assert.Empty(result);
    }

    [Fact]
    public void DirectDependent_IsReturned()
    {
        // B depends on A; blocking A should surface B.
        var edges = new List<(Guid, Guid)> { (B, A) };
        var result = BlockedCascadeWalker.ForwardClosure(edges, A);
        Assert.Equal(new HashSet<Guid> { B }, result);
    }

    [Fact]
    public void TransitiveChain_FullClosure()
    {
        // A <- B <- C <- D : blocking A surfaces B, C, D.
        var edges = new List<(Guid, Guid)> { (B, A), (C, B), (D, C) };
        var result = BlockedCascadeWalker.ForwardClosure(edges, A);
        Assert.Equal(new HashSet<Guid> { B, C, D }, result);
    }

    [Fact]
    public void DiamondShape_DeduplicatedAcrossPaths()
    {
        // A <- B, A <- C, B+C <- D. D appears via two paths but is
        // returned once.
        var edges = new List<(Guid, Guid)>
        {
            (B, A), (C, A), (D, B), (D, C),
        };
        var result = BlockedCascadeWalker.ForwardClosure(edges, A);
        Assert.Equal(new HashSet<Guid> { B, C, D }, result);
    }

    [Fact]
    public void CycleAmongDownstream_DoesNotInfiniteLoop()
    {
        // A <- B, B <- C, C <- B (cycle on the downstream side).
        // The walk terminates and returns B and C.
        var edges = new List<(Guid, Guid)>
        {
            (B, A), (C, B), (B, C),
        };
        var result = BlockedCascadeWalker.ForwardClosure(edges, A);
        Assert.Equal(new HashSet<Guid> { B, C }, result);
    }

    [Fact]
    public void SelfEdgeOnRoot_IsIgnored()
    {
        // Pathological: (A, A) means A depends on itself. The root is
        // never included in its own closure.
        var edges = new List<(Guid, Guid)> { (A, A), (B, A) };
        var result = BlockedCascadeWalker.ForwardClosure(edges, A);
        Assert.Equal(new HashSet<Guid> { B }, result);
        Assert.DoesNotContain(A, result);
    }

    [Fact]
    public void LargeGraph_TerminatesQuickly()
    {
        // 200 nodes in a long chain: A0 <- A1 <- ... <- A199. Closure of
        // A0 should be everyone else. Sanity check that BFS doesn't choke
        // on the cascade-size target from the AC.
        var nodes = Enumerable.Range(0, 200).Select(_ => Guid.NewGuid()).ToArray();
        var edges = new List<(Guid, Guid)>();
        for (var i = 1; i < nodes.Length; i++) edges.Add((nodes[i], nodes[i - 1]));
        var sw = System.Diagnostics.Stopwatch.StartNew();
        var result = BlockedCascadeWalker.ForwardClosure(edges, nodes[0]);
        sw.Stop();
        Assert.Equal(199, result.Count);
        Assert.True(sw.ElapsedMilliseconds < 200,
            $"Expected <200ms but ran for {sw.ElapsedMilliseconds}ms");
    }
}
