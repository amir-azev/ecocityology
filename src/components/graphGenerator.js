export function generateCityGraph(city_area) {
    const categories = [
        { id: "Commercial", maxShapeArea: 0.15 * city_area, color: "#d62728", startingShapeArea: 200, growthRate: 1.5 },
        { id: "Residential", maxShapeArea: 0.35 * city_area, color: "#1f77b4", startingShapeArea: 500 , growthRate: 1.5 },
        { id: "Green Spaces", maxShapeArea: 0.25 * city_area, color: "#2ca02c", startingShapeArea: 400, growthRate: 1.5 },
        // { id: "Transportation", maxShapeArea: 0.05 * city_area, color: "#ff7f0e", startingShapeArea: 200, growthRate: 1.5 },
        { id: "Agriculture", maxShapeArea: 0.05 * city_area, color: "#8c564b", startingShapeArea: 100, growthRate: 1.5 },
        { id: "Public Facilities", maxShapeArea: 0.05 * city_area, color: "#e377c2", startingShapeArea: 150 , growthRate: 1.5},
        { id: "Renewable energy", maxShapeArea: 0.05 * city_area, color: "#06402B", startingShapeArea: 300, growthRate: 1.5 },
        { id: "Industrial", maxShapeArea: 0.05 * city_area, color: "#9467bd", startingShapeArea: 250, growthRate: 1.5 }
    ];

    // Generate nodes
    const nodes = [];
    categories.forEach(category => {
        let numSubAreas = Math.ceil(category.maxShapeArea/ category.startingShapeArea);  // Number of sub-areas per category
        if (numSubAreas === 0) {  // Check if the number of sub-areas is 0
            numSubAreas = 1;  // Set to 1 if no sub-areas
        }

        // Calculate total area available for this category
        const totalArea = category.startingShapeArea * numSubAreas;

        // If there is more than one sub-area, randomly vary the sizes
        let subAreaSizes = [];
        if (numSubAreas > 1) {
            let sumSizes = 0;
            for (let i = 0; i < numSubAreas; i++) {
                // Randomly vary the size by up to +/- 50% of the base startingShapeArea
                const randomFactor = (0.5* Math.random() - 0.5); // Random value between -0.25 and +0.25
                const variedSize = category.startingShapeArea * (1 + randomFactor);
                subAreaSizes.push(variedSize);
                sumSizes += variedSize;
            }

            // Normalize the sizes to ensure the sum equals the total area
            const normalizationFactor = totalArea / sumSizes;
            subAreaSizes = subAreaSizes.map(size => size * normalizationFactor);
        } else {
            subAreaSizes = [category.startingShapeArea];  // If only one sub-area, use the original size
        }

        // Create nodes with adjusted sizes
        for (let i = 0; i < numSubAreas; i++) {
            nodes.push({
                id: `${category.id} ${i + 1}`,   // "Residential 1", "Green Spaces 2", etc.
                category: category.id,
                growthRate: category.growthRate,
                maxShapeArea: category.maxShapeArea,
                startingShapeArea: subAreaSizes[i],   // Assign the adjusted size
                color: category.color,
                label: `${category.id} ${i + 1}`  // Add label for the node (e.g., Residential 1)
            });
        }
    });

    // Define links (relationships) between nodes with weights
    const links = [
        { "source": "Residential", "target": "Green Spaces", "weight": 3 },
        { "source": "Residential", "target": "Commercial", "weight": 5 },
        { "source": "Residential", "target": "Public Facilities", "weight": 3 },
        // { "source": "Residential", "target": "Transportation", "weight": 3 },
        { "source": "Residential", "target": "Agriculture", "weight": 1 },
        { "source": "Residential", "target": "Industrial", "weight": 0 },
        { "source": "Green Spaces", "target": "Commercial", "weight": 3 },
        { "source": "Green Spaces", "target": "Public Facilities", "weight": 4 },
        // { "source": "Commercial", "target": "Transportation", "weight": 5 },
        { "source": "Commercial", "target": "Industrial", "weight": 3 },
        // { "source": "Industrial", "target": "Transportation", "weight": 5 },
        { "source": "Commercial", "target": "Agriculture", "weight": 3 },
        { "source": "Industrial", "target": "Renewable energy", "weight": 5 },
        { "source": "Agriculture", "target": "Renewable energy", "weight": 3 },
        // { "source": "Public Facilities", "target": "Transportation", "weight": 4 }
    ];

    // Generate the links between nodes based on category relationships
    const expandedLinks = [];
    links.forEach(link => {
        const sourceNodes = nodes.filter(n => n.category === link.source);
        const targetNodes = nodes.filter(n => n.category === link.target);

        sourceNodes.forEach(sourceNode => {
            targetNodes.forEach(targetNode => {
                expandedLinks.push({
                    source: sourceNode,
                    target: targetNode,
                    weight: link.weight
                });
            });
        });
    });

    return { nodes, links: expandedLinks };
}

// Example usage:
const city_area = 10000;
const { nodes, links } = generateCityGraph(city_area);
console.log("Nodes:", nodes);
console.log("Links:", links);