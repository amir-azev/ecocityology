# import modules
import numpy as np
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle,Circle,Polygon
from scipy.spatial import Voronoi, voronoi_plot_2d
import json
import os
import sys
# sys.path.append('..')
from Blob2Graph import Blob2Graph


def add_boundary(ax, side_length):
    """
    This function adds a boundary to the city.
    """
    boundary = Rectangle((0, 0), side_length, side_length, edgecolor='black', facecolor='none', linewidth=2, linestyle='--')
    ax.add_patch(boundary)
    return boundary

def add_roads(ax, road_data):
    """
    This function adds roads to the city.
    """
    junctions = road_data['Junctions']
    roads = road_data['Roads']
    extra = 1
    for i in range(len(junctions)):
        i_patch = Rectangle((junctions[i][0]-(road_width+extra)/2, junctions[i][1]-(road_width+extra)/2), road_width+extra, road_width+extra, edgecolor='black', facecolor='black')
        ax.add_patch(i_patch)
        for j in range(len(junctions)):
            if roads[i][j] == 1:
                inline_vector = np.array([junctions[j][0]-junctions[i][0],junctions[j][1]-junctions[i][1]])
                normal_vector = np.array([-inline_vector[1], inline_vector[0]]) / np.linalg.norm(inline_vector)
                patch_edges = ([np.array(junctions[i]) + road_width/2 * normal_vector],[np.array(junctions[j]) + road_width/2 * normal_vector],
                               [np.array(junctions[j]) - road_width/2 * normal_vector],[np.array(junctions[i]) - road_width/2 * normal_vector])
                patch_edges = np.array(patch_edges).reshape(-1, 2)
                patch = Polygon(patch_edges, color='green', alpha=0.5)
                ax.add_patch(patch)
                # ax.plot([junctions[i][0], junctions[j][0]], [junctions[i][1], junctions[j][1]], 'k-', lw=2)
    return junctions

def assign_river(ax, river_centreline, river_width, river_angle):
    """
    This function assigns a river to a city.
    """
    uplist = []
    downlist = []
    # plot river
    final = river_centreline[-1]
    river_centreline.append([final[0]+1,final[1]+1])
    for i_coord in range(len(river_centreline)-1):
        first_coord = river_centreline[i_coord]
        second_coord = river_centreline[i_coord+1]
        inline_vector = np.array([second_coord[1]-first_coord[1],first_coord[0]-second_coord[0]])
        normal_vector = inline_vector / np.linalg.norm(inline_vector)
        uplist.append(first_coord + river_width/2 * normal_vector)
        downlist.append(first_coord - river_width/2 * normal_vector)

    river_coords = np.array(uplist + downlist[::-1])
    river_patch = Polygon(river_coords, color='k', alpha=0.5,hatch='\\')
    ax.add_patch(river_patch)
    
    return river_patch


def place_building(ax,building_type, x, y, dimensions,rotation):
    """
    This function places a building of a given type at a given location with a given width and height.
    """
    if building_type == 'residential':
        color = 'blue'
    elif building_type == 'commercial':
        color = 'red'
    elif building_type == 'industrial':
        color = 'grey'
    else:
        color = 'black'

    if dimensions[0] == "circle":
        radius = dimensions[1]
        building_patch = Circle((x, y), radius, color=color, alpha=0.5)
    elif dimensions[0] == "rectangle":
        p_func = Rectangle
        width = dimensions[1]
        height = dimensions[2]
        basecorners = np.array([[0,0],[width,0],[width,height],[0,height]])
        rot_matrix = np.array([[np.cos(rotation),-np.sin(rotation)],[np.sin(rotation),np.cos(rotation)]])
        corners = np.dot(basecorners,rot_matrix) + np.array([x,y])
        building_patch = Polygon(corners, color=color, alpha=0.5)

    return building_patch
    
def check_interaction(patch, filled_space):
    """
    This function checks if a building patch intersects with any other building patches.
    """
    for other_patch in filled_space:
        if patch.get_path().intersects_path(other_patch.get_path()):
            return True
    return False
    

def add_req_buildings(ax,req_buildings,side_length):
    for building in req_buildings:
        placed = False
        building_type = building[0]
        dimensions = building[1]
        n = 0
        while (not placed and n <= 3):

            x = np.random.uniform(300, side_length)
            y = np.random.uniform(300, side_length)
            rotation = np.random.uniform(0, 2*np.pi)
            # print(f"{n}:attempting placement at x {x}, y {y}, rotation {rotation}")
            patch = place_building(ax,building_type, x, y, dimensions,rotation)
            if not check_interaction(patch, ax.patches):
                ax.add_patch(patch)
                placed = True
            n+=1
    return

def add_blobs(ax, blobData):
    """
    This function adds blobs to the city.
    """
    for blob in range(np.size(blobData["cityShapes"])):
        borderArray = np.array(blobData["cityShapes"][blob]["outerPolygon"])
        borderArray = np.concatenate([borderArray[0:],borderArray[0:2].reshape(2,2)])

        upArray = []
        downArray = []
        for i in range(len(borderArray)-1):
            inline_vector = np.array([borderArray[i+1][0]-borderArray[i][0],borderArray[i+1][1]-borderArray[i][1]])
            normal_vector = np.array([-inline_vector[1], inline_vector[0]]) / np.linalg.norm(inline_vector)
            upArray.append(borderArray[i] + road_width/2 * normal_vector)
            downArray.append(borderArray[i] - road_width/2 * normal_vector)

        border_coords = np.array(upArray + downArray[::-1])
        border_patch = Polygon(border_coords, color='black', alpha=0.5,hatch='\\')
        ax.add_patch(border_patch)

        nodes, edges = Blob2Graph(borderArray,10)
        add_roads(ax, {'Junctions':nodes,'Roads':edges})


with open('exportData(3).txt', "r") as f:
    blobData = json.load(f)

road_width = 2  # road width in meters

fig, ax = plt.subplots(figsize=(10, 10))
side_length = 550
# create a plot
ax.set_xlim([300, side_length])   # set the x-axis limits
ax.set_ylim([300, side_length])   # set the y-axis limits
ax.set_aspect('equal')  # make the x and y axes have the same scale

add_boundary(ax, side_length)
add_blobs(ax, blobData)
rect = Rectangle((0, 460), 1000, 200, edgecolor='black', facecolor='r', linewidth=2, hatch = 'x')
ax.add_patch(rect)

required = [['residential',["rectangle",0.1,5]],['commercial',["circle",0.1,5]]]
for loop in range(3000):
    required.append(['residential',["rectangle",np.random.uniform(0.1,3),np.random.uniform(0.1,3)]])
add_req_buildings(ax,required,side_length)


plt.show()
