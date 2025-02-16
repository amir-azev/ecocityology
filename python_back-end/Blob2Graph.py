#%%
# Blob2Graph
# Takes as input blob definitions, outputs graph of intersections with
#edges as roads

import numpy as np
import matplotlib.pyplot as plt
from shapely.geometry import Point, Polygon, LineString
from scipy.sparse import lil_matrix
import json
import networkx as nx

#%% example region definition (circle)
theta = np.linspace(0, 2*np.pi -0.1, 100)
r = 1
borderArray = np.array([r*np.cos(theta), r*np.sin(theta)]).T
#%% import blob data
with open('c://Users//Basil//Desktop//Uni//Year_4//Hackathon//ecocityology//exportData(3).txt', "r") as f:
    blobData = json.load(f)
    
#example border Array:
borderArray = np.array(blobData["cityShapes"][0]["outerPolygon"])
#target grid pitch
L = 10
# %%
def getGraph(borderArray):
    # find smallest and largest x and y values
    minX = np.min(borderArray[:,0])
    minY = np.min(borderArray[:,1])
    maxX = np.max(borderArray[:,0])
    maxY = np.max(borderArray[:,1])
    # make wider grid
    
#%%


polygon = Polygon(borderArray)

# Generate grid
x_min, y_min, x_max, y_max = polygon.bounds
nCols  = np.round((x_max - x_min)/L).astype(int) 
nRows = np.round((y_max - y_min)/L).astype(int)
x_values = np.linspace(x_min, x_max, nCols)  # Grid resolution
y_values = np.linspace(y_min, y_max, nRows)
xx, yy = np.meshgrid(x_values, y_values)
grid_points = np.vstack([xx.ravel(), yy.ravel()]).T

num_nodes = nRows * nCols

# Create sparse adjacency matrix
adj_matrix = lil_matrix((num_nodes, num_nodes), dtype=int)

for i in range(nRows):
    for j in range(nCols):
        index = i * nCols + j  # Convert 2D index to 1D

        # Right neighbor
        if j + 1 < nCols:
            adj_matrix[index, index + 1] = 1
            adj_matrix[index + 1, index] = 1  # Ensure symmetry

        # Bottom neighbor
        if i + 1 < nRows:
            adj_matrix[index, index + nCols] = 1
            adj_matrix[index + nCols, index] = 1  # Ensure symmetry

#%%
# Filter points inside the polygon
inside_points = np.array([p for p in grid_points if polygon.contains(Point(p))])

# Add intersection nodes at the polygon boundary
intersection_nodes = []
for x in x_values:
    line = LineString([(x, y_min), (x, y_max)])
    intersections = polygon.intersection(line)
    if intersections.geom_type == 'LineString':
        (x0,y0,x1,y1) = intersections.bounds
        intersection_nodes.append((x0, y0))
        intersection_nodes.append((x1, y1))
        print(y0,y1)

    elif intersections.geom_type == 'MultiLineString':
        for line in intersections.geoms:
            (x0,y0,x1,y1) = line.bounds
            intersection_nodes.append((x0, y0))
            intersection_nodes.append((x1, y1))

    elif intersections.geom_type == 'MultiPoint':
        for pt in intersections:
            intersection_nodes.append((pt.x, pt.y))
    elif intersections.geom_type == 'Point':
        intersection_nodes.append((intersections.x, intersections.y))

for y in y_values:
    line = LineString([(x_min, y), (x_max, y)])
    intersections = polygon.intersection(line)
    
    if intersections.geom_type == 'LineString':
        (x0,y0,x1,y1) = intersections.bounds
        intersection_nodes.append((x0, y0))
        intersection_nodes.append((x1, y1))

    elif intersections.geom_type == 'MultiLineString':
        for line in intersections.geoms:
            (x0,y0,x1,y1) = line.bounds
            intersection_nodes.append((x0, y0))
            intersection_nodes.append((x1, y1))

    elif intersections.geom_type == 'MultiPoint':
        for pt in intersections:
            intersection_nodes.append((pt.x, pt.y))
    elif intersections.geom_type == 'Point':
        intersection_nodes.append((intersections.x, intersections.y))



intersection_nodes = np.array(intersection_nodes)
all_nodes = np.vstack([inside_points, intersection_nodes])  # Combine valid grid points and intersections

#%% Create adjacency matrix
num_nodes = len(all_nodes)
adj_matrix = lil_matrix((num_nodes, num_nodes), dtype=int)

# Helper function to find neighbors
from scipy.spatial import KDTree
tree = KDTree(all_nodes)
neighbor_radius = np.min(np.diff(x_values)) * 1.1  # Slightly more than grid spacing

for i, point in enumerate(all_nodes):
    indices = tree.query_ball_point(point, neighbor_radius)
    for j in indices:
        if i != j:
            adj_matrix[i, j] = 1

# Plot results
plt.figure(figsize=(6,6))
plt.plot(*polygon.exterior.xy, 'k-', label='Polygon Boundary')
plt.scatter(inside_points[:, 0], inside_points[:, 1], s=5, color='red', label='Grid Points')
plt.scatter(intersection_nodes[:, 0], intersection_nodes[:, 1], s=20, color='blue', label='Intersection Nodes')
plt.legend()
plt.show()



# %%
