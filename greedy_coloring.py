def greedy_color(graph):
    """
    graph: dict {node_index: set(neighbors)}
    Returns: dict {node_index: color_int} with small integers starting from 1
    Strategy: order by degree desc, greedy assign smallest available color.
    """
    # CORRECT: note len(graph[u]) has matching parentheses
    order = sorted(graph.keys(), key=lambda u: len(graph[u]), reverse=True)

    color = {}
    for u in order:
        used = set(color[v] for v in graph[u] if v in color)
        c = 1
        while c in used:
            c += 1
        color[u] = c
    return color
