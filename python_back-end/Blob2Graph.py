#%%
# Blob2Graph
# Takes as input blob definitions, outputs graph of intersections with
#edges as roads

import numpy as np
import matplotlib.pyplot as plt
from shapely.geometry import Point, Polygon, LineString
from scipy.sparse import dok_matrix
import json
import networkx as nx

#%% example region definition (circle)
if __name__ == '__main__':
    theta = np.linspace(0, 2*np.pi -0.1, 100)
    r = 1
    borderArray = np.array([r*np.cos(theta), r*np.sin(theta)]).T
    #  import blob data
    with open('c://Users//Basil//Desktop//Uni//Year_4//Hackathon//ecocityology//exportData(3).txt', "r") as f:
        blobData = json.load(f)
        
    #example border Array:
    borderArray = np.array(blobData["cityShapes"][1]["outerPolygon"])
    polygon = Polygon(borderArray)
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
def Blob2Graph(borderArray, L):

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
    adj_matrix = np.zeros((num_nodes, num_nodes), dtype=int)

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
    # Filter points inside the polygon
    isInside = np.array([polygon.contains(Point(p)) for p in grid_points])
    inside_points = grid_points[isInside]
    #remove rows and columns from adjacency matrix according to points outside polygon
    adj_matrix = adj_matrix[isInside]
    adj_matrix = adj_matrix[:,isInside]
    # Add intersection nodes at the polygon boundary
    intersection_nodes = []
    additional_edges = []
    row = np.zeros(adj_matrix.shape[0])
    for x in x_values:
        line = LineString([(x, y_min), (x, y_max)])
        intersections = polygon.intersection(line)

        if intersections.geom_type == 'LineString':
            (x0,y0,x1,y1) = intersections.bounds
            intersection_nodes.append((x0, y0))
            intersection_nodes.append((x1, y1))
            # find inside edge indices
            insideX = np.all(np.array([inside_points[:,1] > y0, inside_points[:,1] < y1, inside_points[:, 0] == x]), axis=0)
            idxEdge = np.where(insideX)
            
            minY =idxEdge[0][0]
            maxY = idxEdge[0][-1]
            # #add edges to adjacency matrix
            row1 = row.copy()
            row1[minY] = 1
            additional_edges.append(row1)
            row2 = row.copy()
            row2[maxY] = 1
            additional_edges.append(row2)



        elif intersections.geom_type == 'MultiLineString':
            for line in intersections.geoms:
                (x0,y0,x1,y1) = line.bounds
                intersection_nodes.append((x0, y0))
                intersection_nodes.append((x1, y1))
                insideX = np.all(np.array([inside_points[:,1] > y0, inside_points[:,1] < y1, inside_points[:, 0] == x]), axis=0)
                idxEdge = np.where(insideX)
                
                minY =idxEdge[0][0]
                maxY = idxEdge[0][-1]
                # #add edges to adjacency matrix
                row1 = row.copy()
                row1[minY] = 1
                additional_edges.append(row1)
                row2 = row.copy()
                row2[maxY] = 1
                additional_edges.append(row2)

                

    for y in y_values:
        line = LineString([(x_min, y), (x_max, y)])
        intersections = polygon.intersection(line)
        
        if intersections.geom_type == 'LineString':
            (x0,y0,x1,y1) = intersections.bounds
            intersection_nodes.append((x0, y0))
            intersection_nodes.append((x1, y1))
            # find inside edge indices
            insideY = np.all(np.array([inside_points[:,0] > x0, inside_points[:,0] < x1, inside_points[:, 1] == y]), axis=0)
            idxEdge = np.where(insideY)
            minX =idxEdge[0][0]
            maxX = idxEdge[0][-1]
            # #add edges to adjacency matrix
            row1 = row.copy()
            row1[minX] = 1
            additional_edges.append(row1)
            row2 = row.copy()
            row2[maxX] = 1
            additional_edges.append(row2)
        elif intersections.geom_type == 'MultiLineString':
            for line in intersections.geoms:
                (x0,y0,x1,y1) = intersections.bounds
                intersection_nodes.append((x0, y0))
                intersection_nodes.append((x1, y1))
                # find inside edge indices
                insideY = np.all(np.array([inside_points[:,0] > x0, inside_points[:,0] < x1, inside_points[:, 1] == y]), axis=0)
                idxEdge = np.where(insideY)
                minX =idxEdge[0][0]
                maxX = idxEdge[0][-1]
                # #add edges to adjacency matrix
                row1 = row.copy()
                row1[minX] = 1
                additional_edges.append(row1)
                row2 = row.copy()
                row2[maxX] = 1
                additional_edges.append(row2)


    intersection_nodes = np.array(intersection_nodes)
    all_nodes = np.vstack([inside_points, intersection_nodes])  # Combine valid grid points and intersections
    # combine adjacency matrix with additional edges
    addMat = np.vstack(additional_edges)
    adj_matrix = np.hstack([np.vstack([adj_matrix, addMat]), np.vstack([addMat.T, np.zeros((addMat.shape[0], addMat.shape[0]))])])

    return all_nodes, adj_matrix


#%% Plot results
if __name__ == '__main__':
    plt.figure(figsize=(6,6))
    plt.plot(*polygon.exterior.xy, 'k-', label='Polygon Boundary')
    #plt.scatter(inside_points[:, 0], inside_points[:, 1], s=5, color='red', label='Grid Points')
    #plt.scatter(intersection_nodes[:, 0], intersection_nodes[:, 1], s=20, color='blue', label='Intersection Nodes')
    # add edges
    for i in range(adj_matrix.shape[0]):
        for j in range(i, adj_matrix.shape[1]):
            if adj_matrix[i,j] == 1:
                plt.plot([all_nodes[i,0], all_nodes[j,0]], [all_nodes[i,1], all_nodes[j,1]], 'g-')

    plt.legend()
    plt.show()



# %%
