import numpy as np
import matplotlib.pyplot as plt
from shapely.geometry import Polygon as ShapelyPolygon, Point, LineString, MultiLineString
from shapely.ops import unary_union
from shapely.affinity import rotate
import json
from Blob2Graph import Blob2Graph

def add_boundary(ax, side_length):
    """
    Adds a city boundary with a hashed background.
    """
    boundary_coords = [(0, 0), (side_length, 0), (side_length, side_length), (0, side_length)]
    boundary_polygon = ShapelyPolygon(boundary_coords)

    if not boundary_polygon.is_valid:
        boundary_polygon = boundary_polygon.buffer(0)

    x, y = boundary_polygon.exterior.xy
    ax.plot(x, y, linestyle='--', linewidth=2, color="black")

    # Add a hashed overlay
    ax.fill(x, y, color="white", alpha=0.5, hatch="x")

    return boundary_polygon

def add_roads(ax, road_data):
    """
    Draws roads as lines and returns a MultiLineString for collision checking.
    """
    junctions = [Point(coord) for coord in road_data['Junctions']]
    roads = []

    for i, j in zip(*np.where(np.array(road_data['Roads']) == 1)):
        if i < j:  # Avoid duplicate roads
            road_line = LineString([junctions[i].coords[0], junctions[j].coords[0]])
            roads.append(road_line)

    road_network = MultiLineString(roads)

    for line in road_network.geoms:
        x, y = line.xy
        ax.plot(x, y, color="black", linewidth=3)  # Adjust thickness for better visibility

    return unary_union(road_network)  # Combine all roads for efficient intersection checking

def add_blobs(ax, blobData):
    """
    Adds blobs as valid polygons.
    """
    blobs = []
    for blob in blobData["cityShapes"]:
        polygon = ShapelyPolygon(blob["outerPolygon"])

        if not polygon.is_valid:
            polygon = polygon.buffer(0)

        blobs.append(polygon)
        x, y = polygon.exterior.xy
        ax.fill(x, y, color="black", alpha=0.5, hatch="\\")

    return blobs


def place_building(ax, building_type, blobs, filled_space, road_network):
    """
    Places a building only inside blobs and ensures no intersection with roads or existing buildings.
    """
    color_map = {'residential': 'blue', 'commercial': 'red', 'industrial': 'gray'}
    color = color_map.get(building_type, 'black')

    attempts = 0
    while attempts < 50:
        blob = np.random.choice(blobs)  # Select a random blob
        minx, miny, maxx, maxy = blob.bounds  # Get bounding box of blob

        x, y = np.random.uniform(minx, maxx), np.random.uniform(miny, maxy)
        width, height = np.random.uniform(2, 6), np.random.uniform(2, 6)  # Shrink buildings
        rotation = np.random.uniform(0, 360)

        # Create building as a rectangle
        base_shape = ShapelyPolygon([(0, 0), (width, 0), (width, height), (0, height)])
        rotated_shape = rotate(base_shape, rotation, origin=(0, 0))
        building = ShapelyPolygon([(px + x, py + y) for px, py in rotated_shape.exterior.coords])

        # Ensure building is inside a blob, does not overlap existing buildings, and does not intersect roads
        if (blob.contains(building) and 
            not any(building.intersects(existing) for existing in filled_space) and 
            not building.intersects(road_network)):  # Check road intersection
            filled_space.append(building)
            x, y = building.exterior.xy
            
            building_coords = list(zip(x, y))
            # building_data.append([building_type, building_coords])

            ax.fill(x, y, color=color, alpha=0.5)
            return [building_type, building_coords]

        attempts += 1
    return None

def add_req_buildings(ax, req_buildings, blobs, filled_space, road_network):
    """
    Adds required buildings inside blobs without intersection with roads.
    """
    building_data = []

    for building_type in req_buildings:
        building = place_building(ax, building_type, blobs, filled_space, road_network)
        if building is not None:
            building_data.append(building)

    with open("building_data.json", "w") as f:
        json.dump(building_data, f, indent=4)

# Load blob data
##############################################
#          Running Function
##############################################
def blob2map(display = False):
    with open('exportData(3).txt', "r") as f:
        blobData = json.load(f)

    fig, ax = plt.subplots(figsize=(10, 10))
    side_length = 550
    ax.set_xlim([0, side_length])
    ax.set_ylim([300, side_length])
    ax.set_aspect('equal')

    blobs = add_blobs(ax, blobData)
    city_boundary = add_boundary(ax, side_length)

    # Generate roads for each blob
    all_roads = []
    for blob in range(len(blobData["cityShapes"])):
        borderArray = np.array(blobData["cityShapes"][blob]["outerPolygon"])
        junctions, roads = Blob2Graph(borderArray, 10)
        road_data = {
            'Junctions': junctions,
            'Roads': roads
        }
        road_network = add_roads(ax, road_data)
        all_roads.append(road_network)

    # Merge all roads into a single MultiLineString
    combined_roads = unary_union(all_roads)

    # Add required buildings inside blobs
    filled_space = []
    required_buildings = ['residential'] * 500 + ['commercial'] * 250  # Shrink count to reduce overlap
    add_req_buildings(ax, required_buildings, blobs, filled_space, combined_roads)

    if display:
        plt.show()
    

    return


blob2map(True)
