import numpy as np
import matplotlib.pyplot as plt
from shapely.geometry import Polygon as ShapelyPolygon, Point, LineString, MultiLineString
from shapely.ops import unary_union
from shapely.affinity import rotate
import json
from Blob2Graph import Blob2Graph

region_info = {
    "Residential": {"density": 7, "probabilities": {"residential": 0.8, "commercial": 0.15, "industrial": 0.05}, "fill_attempts": 100},
    "Town Centre": {"density": 8, "probabilities": {"residential": 0.4, "commercial": 0.5, "industrial": 0.1}, "fill_attempts": 80},
    "Market": {"density": 10, "probabilities": {"residential": 0.3, "commercial": 0.6, "industrial": 0.1}, "fill_attempts": 70},
    "Commercial": {"density": 12, "probabilities": {"residential": 0.2, "commercial": 0.7, "industrial": 0.1}, "fill_attempts": 60},
    "Industrial": {"density": 12, "probabilities": {"residential": 0.1, "commercial": 0.2, "industrial": 0.7}, "fill_attempts": 50}
}
building_styles = {
    "residential": {"colour": "blue", "dimensions": (1, 6)},
    "industrial": {"colour": "purple", "dimensions": (3, 10)},
    "commercial": {"colour": "red", "dimensions": (4, 7)},
}


def add_boundary(ax, side_length):
    boundary_coords = [(0, 0), (side_length, 0), (side_length, side_length), (0, side_length)]
    boundary_polygon = ShapelyPolygon(boundary_coords)
    if not boundary_polygon.is_valid:
        boundary_polygon = boundary_polygon.buffer(0)
    x, y = boundary_polygon.exterior.xy
    ax.plot(x, y, linestyle='--', linewidth=2, color="black")
    ax.fill(x, y, color="white", alpha=0.5, hatch="x")
    return boundary_polygon

def generate_blob_grid(blob):
    """
    Generates a road grid for an individual blob.
    """
    borderArray = np.array(blob["outerPolygon"])
    density = region_info[blob["id"]]["density"]
    while True:
        try:
            junctions, roads = Blob2Graph(borderArray, density) #np.random.randint(9, 10))  # Vary density
            break
        except IndexError:
            density+=0.1
            print(f"density:{density}")
    return {'Junctions': junctions, 'Roads': roads}

def add_roads(ax, road_data):
    junctions = [Point(coord) for coord in road_data['Junctions']]
    roads = []
    for i, j in zip(*np.where(np.array(road_data['Roads']) == 1)):
        if i < j:
            road_line = LineString([junctions[i].coords[0], junctions[j].coords[0]])
            roads.append(road_line)
    road_network = MultiLineString(roads)
    for line in road_network.geoms:
        x, y = line.xy
        ax.plot(x, y, color="black", linewidth=2)
    return unary_union(road_network)

def add_blobs(ax, blobData):
    blobs = []
    for blob in blobData["cityShapes"]:
        polygon = ShapelyPolygon(blob["outerPolygon"])
        if not polygon.is_valid:
            polygon = polygon.buffer(0)
        blobs.append(polygon)
        x, y = polygon.exterior.xy
        ax.fill(x, y, color="black", alpha=0.5, hatch="\\")
    return blobs

def place_building(ax, building_type, blob, filled_space, road_network):
    color_map = {'residential': 'blue', 'commercial': 'red', 'industrial': 'purple'}
    color = color_map.get(building_type, 'black')
    attempts = 0
    x_bar,y_bar = building_styles[building_type]["dimensions"]
    while attempts < 50:
        minx, miny, maxx, maxy = blob.bounds
        x, y = np.random.uniform(minx, maxx), np.random.uniform(miny, maxy)
        width, height = np.random.uniform(x_bar,y_bar), np.random.uniform(x_bar,y_bar)
        rotation = np.random.uniform(0, 90)
        base_shape = ShapelyPolygon([(0, 0), (width, 0), (width, height), (0, height)])
        rotated_shape = rotate(base_shape, rotation, origin=(0, 0))
        building = ShapelyPolygon([(px + x, py + y) for px, py in rotated_shape.exterior.coords])
        if (blob.contains(building) and 
            not any(building.intersects(existing) for existing in filled_space) and 
            not building.intersects(road_network)):
            filled_space.append(building)
            x, y = building.exterior.xy
            ax.fill(x, y, color=color, alpha=0.5)
            return [building_type, list(zip(x, y))]
        attempts += 1
    return None

def add_req_buildings(ax, blob, road_network):
    building_data = []
    filled_space = []
    polyBlob = ShapelyPolygon(blob["outerPolygon"])
    for _ in range(region_info[blob["id"]]["fill_attempts"]):
        building_type = np.random.choice(['residential', 'commercial', 'industrial'], p=list(region_info[blob["id"]]["probabilities"].values()))
        building = place_building(ax, building_type, polyBlob, filled_space, road_network)
        if building is not None:
            building_data.append(building)
    return building_data

def blob2map(display=False):
    with open('exportData(3).txt', "r") as f:
        blobData = json.load(f)
    fig, ax = plt.subplots(figsize=(10, 10))
    side_length = 550
    ax.set_xlim([0, side_length])
    ax.set_ylim([300, side_length])
    ax.set_aspect('equal')
    blobs = add_blobs(ax, blobData)
    city_boundary = add_boundary(ax, side_length)
    all_buildings = []
    for blob in blobData["cityShapes"]:
        if blob["id"][0:4] == "Park": # Don't fill parks with houses
            break
        road_data = generate_blob_grid(blob)
        road_network = add_roads(ax, road_data)
        buildings = add_req_buildings(ax, blob, road_network)
        all_buildings.extend(buildings)
    with open("building_data.json", "w") as f:
        json.dump(all_buildings, f, indent=4)
    if display:
        plt.show()
    return

blob2map(True)