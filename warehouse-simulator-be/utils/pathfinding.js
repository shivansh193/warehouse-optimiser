class Node {
    constructor(x, y, parent = null, g = 0, h = 0) {
        this.x = x;
        this.y = y;
        this.parent = parent; // To reconstruct path
        this.g = g;           // Cost from start to current node
        this.h = h;           // Heuristic cost from current node to end
        this.f = g + h;       // Total estimated cost
    }

    equals(otherNode) {
        return this.x === otherNode.x && this.y === otherNode.y;
    }
}

// Heuristic function (Manhattan distance)
function manhattanDistance(nodeA, nodeB) {
    return Math.abs(nodeA.x - nodeB.x) + Math.abs(nodeA.y - nodeB.y);
}

/**
 * A* Pathfinding Algorithm
 * @param {number[][]} grid - 2D array where 0 is walkable, 1 is obstacle
 * @param {{x: number, y: number}} startCoords - Start coordinates
 * @param {{x: number, y: number}} endCoords - End coordinates
 * @param {number} roomWidth - Width of the grid
 * @param {number} roomHeight - Height of the grid
 * @returns {{path: {x:number, y:number}[], cost: number} | null} - Path and cost, or null if no path
 */
function findPathAStar(grid, startCoords, endCoords, roomWidth, roomHeight) {
    const startNode = new Node(startCoords.x, startCoords.y);
    const endNode = new Node(endCoords.x, endCoords.y);

    // Check if start or end is out of bounds or an obstacle (unless it's the target itself and we are pathing TO it)
    // A more robust check would be if the *access point* to an obstacle is valid.
    // For simplicity, if endCoords is an obstacle, we assume it's the target shelf block
    // and A* should find a path to an adjacent walkable cell if needed.
    // This simplified A* doesn't handle "pathing to an adjacent cell of an obstacle" directly.
    // It assumes start and end points provided are themselves walkable, or A* will fail if they are obstacles.

    if (startCoords.x < 0 || startCoords.x >= roomWidth || startCoords.y < 0 || startCoords.y >= roomHeight ||
        endCoords.x < 0 || endCoords.x >= roomWidth || endCoords.y < 0 || endCoords.y >= roomHeight) {
        console.error("A* Error: Start or End coordinates out of bounds.");
        return null;
    }

    // If start or end is an obstacle in the grid (grid[y][x] === 1)
    // A robust A* should path to a valid neighbor if the target itself is an obstacle.
    // This implementation assumes start/end are meant to be walkable.
    if (grid[startNode.y]?.[startNode.x] === 1) {
        // console.warn(`A* Warning: Start node (${startNode.x},${startNode.y}) is an obstacle.`);
        // return null; // Or find nearest walkable neighbor
    }
    // No need to check endNode here as A* will fail to reach it if it's an obstacle with no path

    let openSet = [startNode];
    let closedSet = new Set(); // Store string "x,y" for efficient lookup

    while (openSet.length > 0) {
        // Get node with the lowest f cost from openSet (simple array sort for now, use min-heap for perf)
        openSet.sort((a, b) => a.f - b.f);
        let currentNode = openSet.shift();

        if (currentNode.equals(endNode)) {
            // Path found, reconstruct it
            let path = [];
            let temp = currentNode;
            while (temp) {
                path.push({ x: temp.x, y: temp.y });
                temp = temp.parent;
            }
            return { path: path.reverse(), cost: currentNode.g };
        }

        closedSet.add(`${currentNode.x},${currentNode.y}`);

        // Get neighbors (4-directional)
        const neighbors = [];
        const moves = [[0, -1], [0, 1], [-1, 0], [1, 0]]; // Up, Down, Left, Right

        for (const move of moves) {
            const neighborX = currentNode.x + move[0];
            const neighborY = currentNode.y + move[1];

            // Check bounds
            if (neighborX < 0 || neighborX >= roomWidth || neighborY < 0 || neighborY >= roomHeight) {
                continue;
            }
            // Check if walkable (grid[y][x] === 0)
            if (grid[neighborY][neighborX] === 1) {
                continue;
            }
            // Check if already in closedSet
            if (closedSet.has(`${neighborX},${neighborY}`)) {
                continue;
            }

            const gCost = currentNode.g + 1; // Assuming cost of 1 for each step
            let neighborNode = openSet.find(node => node.x === neighborX && node.y === neighborY);

            if (!neighborNode) { // If neighbor not in openSet, create it
                const hCost = manhattanDistance({x: neighborX, y: neighborY}, endNode);
                neighborNode = new Node(neighborX, neighborY, currentNode, gCost, hCost);
                openSet.push(neighborNode);
            } else if (gCost < neighborNode.g) { // If already in openSet but found a shorter path to it
                neighborNode.g = gCost;
                neighborNode.f = neighborNode.g + neighborNode.h;
                neighborNode.parent = currentNode;
            }
        }
    }
    // No path found
    console.warn(`A*: No path found from (${startCoords.x},${startCoords.y}) to (${endCoords.x},${endCoords.y})`);
    return null;
}


module.exports = { findPathAStar, manhattanDistance };