def bellman_ford_shortest_path(n, edges, src):
    """
    n: number of vertices (0..n-1)
    edges: list of (u, v, w)
    src: source index
    Returns: (dist, parent, negative_cycle_flag)
    """
    INF = float("inf")
    dist = [INF] * n
    parent = [-1] * n
    dist[src] = 0.0

    # Relax edges n-1 times
    for _ in range(n - 1):
        updated = False
        for u, v, w in edges:
            if dist[u] != INF and dist[u] + w < dist[v]:
                dist[v] = dist[u] + w
                parent[v] = u
                updated = True
        if not updated:
            break

    # Check negative cycles
    for u, v, w in edges:
        if dist[u] != INF and dist[u] + w < dist[v]:
            return dist, parent, True

    return dist, parent, False
