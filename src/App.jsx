import React, { useCallback, useEffect, useState, useMemo, useRef, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import DATA from './10k.json';

/**
 * Builds a tree structure from raw hierarchical data - MEMOIZED
 * Only rebuilds if DATA reference changes 
 * @param {Array} rawData - Array of node objects with parent relationships
 * @returns {Object} tree - Object where keys are node IDs and values are node objects with children
 */
const buildTree = (() => {
  let cachedTree = null;
  let cachedData = null;

  return (rawData) => {
        // Return cached tree if data hasn't changed
    if (cachedData === rawData && cachedTree) {
      return cachedTree;
    }

    const tree = {};
    const nodeInfo = {};

    // First pass: Extract all node information (name, description)
    rawData.forEach(item => {
      nodeInfo[item.id] = {
        name: item.name,
        description: item.description
      };
    });

    // Second pass: Build the hierarchical relationships
    rawData.forEach(item => {
      // Get all parent levels sorted by level number (level-1, level-2, etc.)
      const parentLevels = Object.keys(item.parent).sort((a, b) =>
        parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])
      );

      let previousNodeId = null; // Track the parent of current node

      // Process each level in the hierarchy from root to leaf
      parentLevels.forEach((levelKey, index) => {
        const currentNodeId = item.parent[levelKey]; // Get node ID at this level

               // Create node if it doesn't exist in tree yet
       if (!tree[currentNodeId]) {
          // Get node info or use default values
          const info = nodeInfo[currentNodeId] || {
            name: `Node ${currentNodeId}`,           // FIX: Added backticks  
            description: `Description for ${currentNodeId}`  // FIX: Added backticks
          }; 

                    // Initialize node with all necessary properties
        tree[currentNodeId] = {
            id: currentNodeId,              // Unique identifier
            label: info.name,                // Display name
            description: info.description,   // Node description
            level: index,                    // Depth in hierarchy (0 = root)
            parentId: previousNodeId,        // Reference to parent node
            children: []                     // Array to store child node IDs
          };
        }

        // Link current node as a child of its parent
        // Check if parent exists and child isn't already added

        if (!tree[previousNodeId]?.childrenSet) {
          if (previousNodeId) {
            tree[previousNodeId].childrenSet = new Set();
          }
        }

        if (
          previousNodeId &&
          !tree[previousNodeId].childrenSet.has(currentNodeId)
        ) {
          tree[previousNodeId].children.push(currentNodeId);
          tree[previousNodeId].childrenSet.add(currentNodeId);
        }

        previousNodeId = currentNodeId;
      });
    });

    // Cache the result
    cachedTree = tree;
    cachedData = rawData;
    return tree;
  };
})();

const getVisibleNodesIterative = (tree, expandedNodes) => {
  const visibleNodeIds = new Set();
  const rootNode = Object.values(tree).find((node) => node.level === 0);
  if (!rootNode) return visibleNodeIds;

  const queue = [rootNode.id];
  while (queue.length) {
    const nodeId = queue.shift();
    visibleNodeIds.add(nodeId);
    if (expandedNodes.has(nodeId)) {
      queue.push(...tree[nodeId].children);
    }
  }
  return visibleNodeIds;
};

const calculateLayout = (() => {
  let cachedPositions = null;
  let cachedTreeKeys = null;

  return (tree) => {
    // Check if tree structure has changed
    const treeKeys = Object.keys(tree).sort().join(',');
    if (cachedTreeKeys === treeKeys && cachedPositions) {
      return cachedPositions;
    }

      // Group nodes by their level (all nodes at same depth together)
  const nodesByLevel = {};
    Object.values(tree).forEach((node) => {
      if (!nodesByLevel[node.level]) {
        nodesByLevel[node.level] = []; // Create array for this level if doesn't exist
      }
      nodesByLevel[node.level].push(node.id);
    });
  
    const positions = {}; // Will store final positions
    const verticalGap = 100;   // Space between levels (y-axis)
    const horizontalGap = 110; // Space between siblings (x-axis)
    
    // Position each level horizontally centered
    Object.entries(nodesByLevel).forEach(([level, nodeIds]) => {
      nodeIds.sort(); // Sort for consistent left-to-right ordering

      // Calculate total width needed for this level
      const totalWidth = (nodeIds.length - 1) * horizontalGap;
      const startX = -totalWidth / 2; // Center around x=0

      // Assign position to each node in this level
      nodeIds.forEach((nodeId, index) => {
        positions[nodeId] = {
          x: startX + index * horizontalGap,  // Spread horizontally
          y: Number(level) * verticalGap      // Stack vertically by level
        };
      });
    });

    // Cache the result
    cachedPositions = positions;
    cachedTreeKeys = treeKeys;
    return positions;
  };
})();

/**
 * Custom React component for rendering individual tree nodes
 * @param {Object} data - Node data passed from ReactFlow
 * 
 * 
 */
const CustomNode = React.memo(function CustomNode({ data }) {
  return (
    <div
      style={{
        padding: '4px 8px',
        border: '1px solid #555',
        borderRadius: 4,
        // Blue background if expanded, white if collapsed
        background: data.isExpanded ? '#bfdeedff' : '#f7f1f1ff',
        // Pointer cursor only if node has children (clickable)
        cursor: data.hasChildren ? 'pointer' : 'default',
        minWidth: 80,
        maxWidth: 110,
        textAlign: 'center',
        fontSize: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
      }}
      // Only trigger toggle if node has children
      onClick={data.hasChildren ? data.onToggle : undefined}
    >
      {/* Display node ID (e.g., "1.2.3") */}
      <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 2, color: '#222' }}>
        {data.nodeId}
      </div>

      {/* Display node name/label */}
      <div style={{ fontSize: 10, color: '#444', marginBottom: 2 }}>
        {data.label}
      </div>

      {/* Display description if available */}
      {data.description && (
        <div
          style={{
            fontSize: 9,
            color: '#666',
            fontStyle: 'Times New Roman',
            marginTop: 2,
          }}
        >
          {data.description}
        </div>
      )}

      {/* Show expand/collapse indicator if node has children */}
      {data.hasChildren && (
        <div style={{ fontSize: 9, color: '#fdf9f9ff', marginTop: 3 }}>
          {data.isExpanded ? '[-]' : '[+]'} {/* [-] = expanded, [+] = collapsed */}
        </div>
      )}

      {/* ReactFlow handles for connecting edges */}
      <Handle type="target" position={Position.Top} />    {/* Incoming edge connection point */}
      <Handle type="source" position={Position.Bottom} /> {/* Outgoing edge connection point */}
    </div>
  );
});

/**
 * Main component that manages the hierarchical tree visualization
 * Handles state management, user interactions, and rendering
 */
const HierarchyTree = React.memo (function HierarchyTree() {
  // Track which nodes are expanded (showing children)
  // Start with root node 'main' expanded by default
  const [expandedNodes, setExpandedNodes] = useState(new Set(['main']));
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);

  // Refs for persistent tree and layout
  const treeRef = useRef(null);
  const nodePositionsRef = useRef(null);

  // useTransition for smooth state updates
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    treeRef.current = buildTree(DATA);
    nodePositionsRef.current = calculateLayout(treeRef.current);
  }, []);

  const onToggle = useCallback(
    (nodeId) => {
      startTransition(() => {
        setExpandedNodes((prev) => {
          const updated = new Set(prev);
          if (updated.has(nodeId)) {
            updated.delete(nodeId);
          } else {
            updated.add(nodeId);
          }
          return updated;
        });
      });
    },
    [startTransition]
  );

  const expandAll = useCallback(() => {
    const allNodeIds = new Set(Object.keys(treeRef.current));
    setExpandedNodes(allNodeIds);// Mark all as expanded
  }, []);

  /**
   * Collapses all nodes except the root
   * User clicks "Collapse All" button
   */
  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(['main'])); // Only root remains expanded
  }, []);

  /**
   * OPTIMIZED: Rebuilds only the visible parts of the tree
   * Uses memoized tree and positions, only recalculates visibility
   */
  const rebuildTree = useCallback(() => {
    // Step 1: Use memoized tree via ref
    const tree = treeRef.current;
    const nodePositions = nodePositionsRef.current;
    if (!tree || !nodePositions) return;

    // Step 2: Determine which nodes should be visible
    const visibleNodeIds = getVisibleNodesIterative(tree, expandedNodes);

    // Step 3: Create ReactFlow nodes and edges arrays (only for visible nodes)
    const reactFlowNodes = [];
    const reactFlowEdges = [];

    Object.values(tree).forEach(node => {
      if (!visibleNodeIds.has(node.id)) return;

      reactFlowNodes.push({
        id: node.id,
        type: 'custom',
        data: {
          nodeId: node.id,
          label: node.label,
          description: node.description,
          isExpanded: expandedNodes.has(node.id),
          hasChildren: node.children.length > 0,
          onToggle: () => onToggle(node.id),
        },
        position: nodePositions[node.id]
    });

    if (node.parentId && visibleNodeIds.has(node.parentId)) {
      reactFlowEdges.push({
        id: `${node.parentId}-${node.id}`,
        source: node.parentId,
        target: node.id
      });
    }
  });

  setNodes(reactFlowNodes);
  setEdges(reactFlowEdges);
}, [expandedNodes, onToggle]);

  useEffect(() => {
    rebuildTree();
  }, [rebuildTree]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Node counter positioned at top-right */}
      <div style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: '8px 16px',
        backgroundColor: '#2196F3',  // Blue
          color: 'white',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        minWidth: '120px'
      }}>
        <div style={{ fontSize: '12px', marginBottom: '2px' }}>Nodes Loaded</div>
        <div style={{ fontSize: '20px' }}>{nodes.length}</div>
      </div>

      {/* Control buttons positioned at top-left */}
      <div style={{ 
          position: 'absolute',
          top: 10,
          left: 10,
        zIndex: 1000,      // Above ReactFlow canvas
          display: 'flex',
          gap: '10px',
        }}
      >
        <button
          onClick={expandAll}
          style={{
            padding: '8px 16px',
            backgroundColor: '#4CAF50',  // Green
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          Expand All
        </button>

        {/* Collapse All button */}
        <button
          onClick={collapseAll}
          style={{
            padding: '8px 16px',
            backgroundColor: '#f44336',  // Red
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
          }}
        >
          Collapse All
        </button>
      </div>

      {/* ReactFlow canvas - the main visualization area */}
      <ReactFlow
        nodes={nodes}                         // Array of nodes to display
        edges={edges}                         // Array of edges to display
        nodeTypes={{ custom: CustomNode }}   // Custom node component
        onlyRenderVisibleElements={true}      // Only render nodes and edges that are visible
        fitView                               // Auto-zoom to fit all nodes in view
        minZoom={0.1}                         // Allow zooming out (10%)
        maxZoom={2}                           // Allow zooming in (200%)
      >
        <Background />  {/* Grid background for visual reference */}
        <Controls />    {/* Zoom and pan controls (bottom-left buttons) */}
      </ReactFlow>
    </div>
  );
});

createRoot(document.getElementById('root')).render(<HierarchyTree />);

// Render the main component to the DOM
// Finds element with id="root" and renders HierarchyTree inside it