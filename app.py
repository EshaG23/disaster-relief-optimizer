from flask import Flask, render_template, request, jsonify
from algorithms.bellman_ford import bellman_ford_shortest_path
from algorithms.fractional_knapsack import fractional_knapsack
from algorithms.greedy_coloring import greedy_color

# NEW: imports for geocoding + distances
import requests, math, time

app = Flask(__name__)

# --------------------- NEW: helpers ---------------------
def haversine_km(a, b):
    R = 6371.0
    lat1, lon1 = math.radians(a[0]), math.radians(a[1])
    lat2, lon2 = math.radians(b[0]), math.radians(b[1])
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    x = math.sin(dlat/2)**2 + math.cos(lat1)*math.cos(lat2)*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(x))

def geocode_nominatim(place, country_bias="India"):
    url = "https://nominatim.openstreetmap.org/search"
    params = {
        "q": f"{place}, {country_bias}",
        "format": "jsonv2",
        "limit": 1
    }
    headers = {"User-Agent": "edu-demo-disaster-relief/1.0 (email@example.com)"}
    r = requests.get(url, params=params, headers=headers, timeout=15)
    r.raise_for_status()
    data = r.json()
    if not data:
        return None
    return (float(data[0]["lat"]), float(data[0]["lon"]))

def osrm_route_distance_km(a, b):
    # Road distance via OSRM public demo; fallback handled by distance_km()
    base = "https://router.project-osrm.org/route/v1/driving"
    coords = f"{a[1]},{a[0]};{b[1]},{b[0]}"
    url = f"{base}/{coords}"
    params = {"overview": "false"}
    try:
        r = requests.get(url, params=params, timeout=15)
        if r.status_code != 200:
            return None
        data = r.json()
        if data.get("routes"):
            meters = data["routes"][0]["distance"]
            return meters / 1000.0  # km
        return None
    except requests.RequestException:
        return None

def distance_km(a, b, metric="road"):
    if metric == "road":
        d = osrm_route_distance_km(a, b)
        if d is not None:
            return d
        # fallback to straight-line if OSRM fails
        return haversine_km(a, b)
    else:
        # "air" => straight-line
        return haversine_km(a, b)

def geocode_many(places):
    coords = []
    for p in places:
        loc = geocode_nominatim(p, "India")
        if not loc:
            raise ValueError(f"Could not geocode: {p}")
        coords.append(loc)
        time.sleep(1)  # be polite to Nominatim
    return coords

def build_distance_matrix(places, metric="road"):
    """
    Returns symmetric NxN matrix in km with 0 on diagonal.
    """
    coords = geocode_many(places)
    n = len(coords)
    mat = [[0.0] * n for _ in range(n)]
    for i in range(n):
        mat[i][i] = 0.0
        for j in range(i + 1, n):
            d = round(distance_km(coords[i], coords[j], metric), 3)
            mat[i][j] = d
            mat[j][i] = d  # enforce symmetry
    return coords, mat

# --------------------- NEW: endpoints ---------------------
@app.route("/api/auto-matrix", methods=["POST"])
def api_auto_matrix():
    data = request.get_json(force=True)
    places = [p.strip() for p in data.get("places", []) if p.strip()]
    if len(places) < 2:
        return jsonify({"error": "Provide at least two place names."}), 400
    metric = (data.get("metric", "road") or "road").lower()
    if metric not in ("road", "air"):
        metric = "road"

    try:
        coords, mat = build_distance_matrix(places, metric)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Distance service error. Try again."}), 502

    return jsonify({
        "names": places,
        "coords": coords,
        "adjacency": mat,
        "unit": "km",
        "metric": metric
    })

@app.route("/api/threshold-adjacency", methods=["POST"])
def api_threshold_adjacency():
    data = request.get_json(force=True)
    places = [p.strip() for p in data.get("places", []) if p.strip()]
    if len(places) < 2:
        return jsonify({"error": "Provide at least two place/zone names."}), 400
    metric = (data.get("metric", "road") or "road").lower()
    if metric not in ("road", "air"):
        metric = "road"
    try:
        threshold = float(data.get("threshold_km", 20))
    except Exception:
        threshold = 20.0

    try:
        coords, dist_mat = build_distance_matrix(places, metric)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception:
        return jsonify({"error": "Distance service error. Try again."}), 502

    n = len(places)
    adj01 = [[0] * n for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i == j:
                adj01[i][j] = 0
            else:
                adj01[i][j] = 1 if dist_mat[i][j] <= threshold else 0

    return jsonify({
        "names": places,
        "coords": coords,
        "distance": dist_mat,
        "adjacency": adj01,
        "threshold_km": threshold
    })

# --------------------- EXISTING ROUTES ---------------------
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/api/bellman-ford", methods=["POST"])
def api_bellman_ford():
    data = request.get_json(force=True)
    names = data["names"]
    adj = data["adjacency"]
    src_name = data["source"]
    dst_name = data["destination"]

    edges = []
    n = len(names)
    for i in range(n):
        for j in range(n):
            w = adj[i][j]
            if w is not None and w != 0:
                edges.append((i, j, float(w)))

    try:
        src = names.index(src_name)
        dst = names.index(dst_name)
    except ValueError:
        return jsonify({"error": "Source or destination name not found."}), 400

    dist, parent, neg_cycle = bellman_ford_shortest_path(n, edges, src)
    if neg_cycle:
        return jsonify({"error": "Negative cycle detected. Route not reliable."}), 400

    path_nodes = []
    cur = dst
    while cur is not None and cur != -1:
        path_nodes.append(cur)
        if cur == src:
            break
        cur = parent[cur]
    if not path_nodes or path_nodes[-1] != src:
        return jsonify({"error": "No path found from source to destination."}), 400

    path_nodes.reverse()
    path_names = [names[i] for i in path_nodes]
    return jsonify({
        "distance": dist[dst],
        "path": path_names
    })

@app.route("/api/knapsack", methods=["POST"])
def api_knapsack():
    data = request.get_json(force=True)
    items = data["items"]
    capacity = float(data["capacity"])
    tuples = [(it["name"], float(it["weight"]), float(it["demand"])) for it in items]
    total_value, taken = fractional_knapsack(tuples, capacity)
    return jsonify({
        "capacity": capacity,
        "total_value": total_value,
        "allocation": taken
    })

@app.route("/api/coloring", methods=["POST"])
def api_coloring():
    data = request.get_json(force=True)
    names = data["names"]
    adj = data["adjacency"]
    max_colors = int(data.get("max_colors", 0))
    n = len(names)
    graph = {i: set() for i in range(n)}
    for i in range(n):
        for j in range(n):
            w = adj[i][j]
            if w is not None and w != 0:
                graph[i].add(j)
                graph[j].add(i)
    colors = greedy_color(graph)
    if max_colors > 0:
        for node in colors:
            colors[node] = ((colors[node] - 1) % max_colors) + 1
    color_map = {names[i]: colors[i] for i in range(n)}
    used_colors = sorted(set(colors.values()))
    return jsonify({
        "coloring": color_map,
        "num_colors": len(used_colors)
    })

if __name__ == "__main__":
    app.run(debug=True)
