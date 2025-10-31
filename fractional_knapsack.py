def fractional_knapsack(items, capacity):
    """
    items: list of (name, weight, value)
    capacity: float
    Returns: (total_value, taken_list)
      taken_list: [{name, weight_taken, value_taken, fraction}]
    """
    # Sort by value/weight ratio (desc)
    items_sorted = sorted(items, key=lambda x: (x[2] / x[1]) if x[1] != 0 else 0, reverse=True)

    total_value = 0.0
    remaining = capacity
    taken = []

    for name, weight, value in items_sorted:
        if remaining <= 0:
            break
        if weight <= remaining:
            # take full
            total_value += value
            remaining -= weight
            taken.append({
                "name": name,
                "weight_taken": weight,
                "value_taken": value,
                "fraction": 1.0
            })
        else:
            # take fraction
            frac = remaining / weight if weight > 0 else 0
            value_taken = value * frac
            total_value += value_taken
            taken.append({
                "name": name,
                "weight_taken": remaining,
                "value_taken": value_taken,
                "fraction": frac
            })
            remaining = 0

    return total_value, taken
