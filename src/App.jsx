import React, { useCallback, useEffect, useState, useRef, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import ReactFlow, { Background, Controls, Handle, Position } from 'reactflow';
import 'reactflow/dist/style.css';
import DATA from './10k.json';

let nodeCounter = 0;
const nodeIndex = {};
const levelIndex = {};

const buildTree = (() => {
  let cachedTree = null;
  let cachedData = null;

  return (rawData) => {
    if (cachedData === rawData && cachedTree) return cachedTree;

    nodeCounter = 0;
    Object.keys(nodeIndex).length = 0;
    Object.keys(levelIndex).length = 0;

    const tree = {};
    const nodeInfo = {};

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      nodeInfo[item.id] = { name: item.name, description: item.description };
      nodeIndex[item.id] = nodeCounter++;
    }

    for (let i = 0; i < rawData.length; i++) {
      const item = rawData[i];
      const parentLevels = Object.keys(item.parent).sort(
        (a, b) => parseInt(a.split('-')[1]) - parseInt(b.split('-')[1])
      );

      let previousNodeId = null;
      for (let j = 0; j < parentLevels.length; j++) {
        const levelKey = parentLevels[j];
        const currentNodeId = item.parent[levelKey];

        if (!tree[currentNodeId]) {
          const info = nodeInfo[currentNodeId] || {
            name: `Node ${currentNodeId}`,
            description: `Description for ${currentNodeId}`,
          };
          tree[currentNodeId] = {
            id: currentNodeId,
            index: nodeIndex[currentNodeId],
            label: info.name,
            description: info.description,
            level: j,
            parentId: previousNodeId,
            parentIndex: previousNodeId ? nodeIndex[previousNodeId] : -1,
            children: [],
            childrenCount: 0,
          };

          if (!levelIndex[j]) levelIndex[j] = [];
          levelIndex[j].push(currentNodeId);
        }

        if (previousNodeId && !tree[previousNodeId]?.childrenSet) {
          tree[previousNodeId].childrenSet = new Set();
        }

        if (previousNodeId && !tree[previousNodeId].childrenSet.has(currentNodeId)) {
          tree[previousNodeId].children.push(currentNodeId);
          tree[previousNodeId].childrenSet.add(currentNodeId);
          tree[previousNodeId].childrenCount++;
        }

        previousNodeId = currentNodeId;
      }
    }

    cachedTree = tree;
    cachedData = rawData;
    return tree;
  };
})();

const getVisibleNodesIterative = (tree, expandedNodes) => {
  const visibleNodeIds = new Set();
  const rootNode = levelIndex[0]?.[0] ? tree[levelIndex[0][0]] : null;
  if (!rootNode) return visibleNodeIds;

  const queue = [rootNode.id];
  let idx = 0;
  while (idx < queue.length) {
    const nodeId = queue[idx++];
    visibleNodeIds.add(nodeId);

    if (expandedNodes.has(nodeId)) {
      const children = tree[nodeId].children;
      for (let i = 0; i < children.length; i++) {
        queue.push(children[i]);
      }
    }
  }
  return visibleNodeIds;
};

const calculateLayout = (() => {
  let cachedPositions = null;
  let cachedTreeKeys = null;

  return (tree) => {
    const treeKeys = Object.keys(tree).sort().join(',');
    if (cachedTreeKeys === treeKeys && cachedPositions) return cachedPositions;

    const positions = {};
    const verticalGap = 100;
    const horizontalGap = 110;

    const maxLevel = Math.max(...Object.keys(levelIndex).map(Number));
    for (let level = 0; level <= maxLevel; level++) {
      if (!levelIndex[level]) continue;

      const nodeIds = levelIndex[level];
      nodeIds.sort((a, b) => nodeIndex[a] - nodeIndex[b]);

      const totalWidth = (nodeIds.length - 1) * horizontalGap;
      const startX = -totalWidth / 2;

      for (let i = 0; i < nodeIds.length; i++) {
        positions[nodeIds[i]] = {
          x: startX + i * horizontalGap,
          y: level * verticalGap,
        };
      }
    }

    cachedPositions = positions;
    cachedTreeKeys = treeKeys;
    return positions;
  };
})();

const CustomNode = React.memo(function CustomNode({ data }) {
  return (
    <div
      style={{
        padding: '4px 8px',
        border: '1px solid #555',
        borderRadius: 4,
        background: data.isExpanded ? '#bfdeedff' : '#f7f1f1ff',
        cursor: data.hasChildren ? 'pointer' : 'default',
        minWidth: 80,
        maxWidth: 110,
        textAlign: 'center',
        fontSize: 8,
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
      }}
      onClick={data.hasChildren ? data.onToggle : undefined}
    >
      <div style={{ fontWeight: 'bold', fontSize: 9, marginBottom: 2, color: '#222' }}>
        {data.nodeId}
      </div>
      <div style={{ fontSize: 10, color: '#444', marginBottom: 2 }}>{data.label}</div>
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
      {data.hasChildren && (
        <div style={{ fontSize: 9, color: '#fdf9f9ff', marginTop: 3 }}>
          {data.isExpanded ? '[-]' : '[+]'}
        </div>
      )}
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
});

const HierarchyTree = React.memo(function HierarchyTree() {
  const [expandedNodes, setExpandedNodes] = useState(new Set(['main']));
  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState(0);

  const treeRef = useRef(null);
  const nodePositionsRef = useRef(null);
  const levelIndexRef = useRef(null);
  const [isPending, startTransition] = useTransition();
  const animationFrameRef = useRef(null);

  useEffect(() => {
    treeRef.current = buildTree(DATA);
    nodePositionsRef.current = calculateLayout(treeRef.current);
    levelIndexRef.current = levelIndex;
  }, []);

  // 🚀 LAZY LOADING: Render nodes in batches using RAF
  const buildNodesAndEdges = useCallback(
    (visibleNodeIds, tree, nodePositions) => {
      const allNodes = [];
      const allEdges = [];

      // Collect all nodes first
      const maxLevel = Math.max(...Object.keys(levelIndex).map(Number));
      for (let level = 0; level <= maxLevel; level++) {
        if (!levelIndex[level]) continue;

        for (let i = 0; i < levelIndex[level].length; i++) {
          const nodeId = levelIndex[level][i];
          const node = tree[nodeId];

          if (!visibleNodeIds.has(nodeId)) continue;

          allNodes.push({
            id: nodeId,
            type: 'custom',
            data: {
              nodeId,
              label: node.label,
              description: node.description,
              isExpanded: expandedNodes.has(nodeId),
              hasChildren: node.childrenCount > 0,
              onToggle: () => onToggle(nodeId),
            },
            position: nodePositions[nodeId],
          });

          if (node.parentId && visibleNodeIds.has(node.parentId)) {
            allEdges.push({
              id: `${node.parentId}-${nodeId}`,
              source: node.parentId,
              target: nodeId,
            });
          }
        }
      }

      // Cancel previous animation frame
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }

      // Lazy render in chunks
      const CHUNK_SIZE = 3000;
      let currentIndex = 0;
      setIsLoading(true);

      const renderChunk = () => {
        const endIndex = Math.min(currentIndex + CHUNK_SIZE, allNodes.length);
        const nodeChunk = allNodes.slice(0, endIndex);
        const edgeChunk = allEdges.filter((edge) =>
          nodeChunk.some((n) => n.id === edge.target)
        );

        setNodes(nodeChunk);
        setEdges(edgeChunk);
        setLoadProgress(Math.round((endIndex / allNodes.length) * 100));

        currentIndex = endIndex;

        if (currentIndex < allNodes.length) {
          animationFrameRef.current = requestAnimationFrame(renderChunk);
        } else {
          setIsLoading(false);
          setLoadProgress(100);
        }
      };

      renderChunk();
    },
    [expandedNodes]
  );

  const onToggle = useCallback(
    (nodeId) => {
      startTransition(() => {
        setExpandedNodes((prev) => {
          const updated = new Set(prev);
          if (updated.has(nodeId)) updated.delete(nodeId);
          else updated.add(nodeId);
          return updated;
        });
      });
    },
    [startTransition]
  );

  const expandAll = useCallback(() => {
    const allNodeIds = new Set(Object.keys(treeRef.current || {}));
    setExpandedNodes(allNodeIds);
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedNodes(new Set(['main']));
  }, []);

  const rebuildTree = useCallback(() => {
    const tree = treeRef.current;
    const nodePositions = nodePositionsRef.current;
    if (!tree || !nodePositions) return;

    // Cancel any ongoing lazy load
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }

    const visibleNodeIds = getVisibleNodesIterative(tree, expandedNodes);
    buildNodesAndEdges(visibleNodeIds, tree, nodePositions);
  }, [expandedNodes, buildNodesAndEdges]);

  useEffect(() => {
    rebuildTree();

    // Cleanup on unmount
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [rebuildTree]);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      {/* Loading Progress Bar */}
      {isLoading && (
        <div
          style={{
            position: 'absolute',
            top: 60,
            left: 10,
            right: 10,
            zIndex: 1000,
            height: '4px',
            backgroundColor: '#e0e0e0',
            borderRadius: '2px',
            overflow: 'hidden',
            maxWidth: '300px',
          }}
        >
          <div
            style={{
              width: `${loadProgress}%`,
              height: '100%',
              backgroundColor: '#2196F3',
              transition: 'width 0.2s ease',
            }}
          />
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          top: 10,
          left: 10,
          zIndex: 1000,
          display: 'flex',
          gap: '10px',
        }}
      >
        <button
          onClick={expandAll}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: isLoading ? '#ccc' : '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Expand All
        </button>
        <button
          onClick={collapseAll}
          disabled={isLoading}
          style={{
            padding: '8px 16px',
            backgroundColor: isLoading ? '#ccc' : '#f44336',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: isLoading ? 'not-allowed' : 'pointer',
            fontSize: '14px',
            fontWeight: 'bold',
          }}
        >
          Collapse All
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          zIndex: 1000,
          padding: '8px 16px',
          backgroundColor: '#2196F3',
          color: 'white',
          borderRadius: '4px',
          fontSize: '14px',
          fontWeight: 'bold',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          minWidth: '120px',
        }}
      >
        <div style={{ fontSize: '12px', marginBottom: '2px' }}>
          {isLoading ? `Loading ${loadProgress}%` : 'Nodes Loaded'}
        </div>
        <div style={{ fontSize: '20px' }}>{nodes.length}</div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={{ custom: CustomNode }}
        onlyRenderVisibleElements={true}
        fitView
        minZoom={0.1}
        maxZoom={2}
      >
        <Background />
        <Controls />
      </ReactFlow>
    </div>
  );
});

createRoot(document.getElementById('root')).render(<HierarchyTree />);
