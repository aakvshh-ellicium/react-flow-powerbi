import * as React from "react";
import {
  ReactFlow,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Node,
  Edge,
  Connection,
  MarkerType,
} from "@xyflow/react";
import CustomNode from "./components/CustomNode";
import "@xyflow/react/dist/style.css";
import styled from "styled-components";

// Node state interface
export interface NodeState {
  id: string;
  label: string;
  position: { x: number; y: number };
  count?: number;
  percentChange?: number;
}

// Props from Power BI visual
interface Props {
  nodesFromVisual?: NodeState[];
  edgesFromVisual?: Edge[];
  onChartChange?: (updatedNodes: Node[] | NodeState[]) => void;
  onEdgesUpdate?: (updatedEdges: Edge[]) => void;
}

const defaultNodes: Node[] = [
  { id: "1", position: { x: 0, y: 0 }, data: { label: "1" } },
  { id: "2", position: { x: 100, y: 100 }, data: { label: "2" } },
  { id: "3", position: { x: -100, y: 100 }, data: { label: "3" } },
];

const initialEdges: Edge[] = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e1-3", source: "1", target: "3" },
];

const nodeTypes = {
  custom: CustomNode,
};

const ReactFlowStyled = styled(ReactFlow)`
  background-color: ${(props) => props.theme.bg};
`;

const ControlsStyled = styled(Controls)`
  button {
    background-color: ${(props) => props.theme.controlsBg};
    color: ${(props) => props.theme.controlsColor};
    border-bottom: 1px solid ${(props) => props.theme.controlsBorder};

    &:hover {
      background-color: ${(props) => props.theme.controlsBgHover};
    }

    path {
      fill: currentColor;
    }
  }
`;

const ReactFlowComponent: React.FC<Props> = ({
  nodesFromVisual,
  onChartChange,
  edgesFromVisual,
  onEdgesUpdate,
}) => {
  const [nodes, setNodes, defaultOnNodesChange] = useNodesState(defaultNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedNode, setSelectedNode] = React.useState<Node | null>(null);

  const onNodesChange = React.useCallback(
    (changes) => {
      defaultOnNodesChange(changes);

      const positionChanged = changes.some(
        (c) => c.type === "position" && c.dragging === false
      );
      if (positionChanged) {
        // React Flow already updates positions, just send the current state to parent
        setNodes((nds) => {
          console.log("component nodes 1", nds);
          onChartChange?.(nds); // Send updated nodes to visual
          return nds;
        });
      }
    },
    [defaultOnNodesChange, setNodes, onChartChange]
  );

  const onConnect = React.useCallback(
    (params: Edge | Connection) => {
      setEdges((eds) => {
        const updated = addEdge(params, eds);
        onEdgesUpdate?.(updated);
        return updated;
      });
    },
    [setEdges, onEdgesUpdate]
  );

  React.useEffect(() => {
    if (nodesFromVisual && nodesFromVisual.length > 0) {
      const formatted = nodesFromVisual.map((node) => ({
        id: node.id,
        data: {
          label: node.label,
          percentChange: node.percentChange, // 💡 storing percentChange inside `data`
        },
        type: "custom",
        position: node.position,
      }));

      const existingNodeIds = new Set(nodes.map((n) => n.id));
      const newNodes = formatted.filter((n) => !existingNodeIds.has(n.id));

      if (selectedNode && newNodes.length > 0) {
        const allChildren = nodes.filter((n) =>
          edges.some((e) => e.source === selectedNode.id && e.target === n.id)
        );

        const updatedChildren = [...allChildren, ...newNodes];

        const newNodesWithPosition = updatedChildren.map((node, idx) => {
          const isEven = idx % 2 === 0;
          const offsetMultiplier = Math.floor((idx + 1) / 2);
          return {
            ...node,
            position: {
              x:
                selectedNode.position.x +
                (isEven ? 250 * offsetMultiplier : -250 * offsetMultiplier),
              y: selectedNode.position.y + 150,
            },
            data: node.data,
          };
        });

        setNodes((nds) => {
          const remainingNodes = nds.filter(
            (n) => !updatedChildren.find((child) => child.id === n.id)
          );
          const updated = [...remainingNodes, ...newNodesWithPosition];
          console.log("component nodes 2", updated);

          onChartChange?.(updated);
          return updated;
        });

        const newEdges: Edge[] = newNodesWithPosition.map((node) => {
          const percentChange = node.data?.percentChange ?? 0;

          return {
            id: `e${selectedNode.id}-${node.id}`,
            source: selectedNode.id,
            target: node.id,
            label: `${percentChange}%`,
            style: { stroke: "#183B4E", strokeWidth: 2.5 },
            markerEnd: {
              type: MarkerType.Arrow,
              color: "#183B4E",
              strokeWidth: 1.5,
            },
            type: "step",
            data: {
              percentChange,
            },
          };
        });

        setEdges((eds) => {
          const updated = [...eds, ...newEdges];
          onEdgesUpdate?.(updated);
          return updated;
        });
      } else {
        setNodes(() => {
          console.log("component nodes 3", formatted);

          onChartChange?.(formatted);
          return formatted;
        });

        if (edgesFromVisual && edgesFromVisual.length > 0) {
          setEdges(edgesFromVisual);
        } else {
          const rootId = formatted[0].id;
          const formattedEdges = formatted.slice(1).map((node, idx) => ({
            id: `e${rootId}-${node.id}`,
            source: idx === 0 ? rootId : formatted[idx].id,
            target: node.id,
            label: `${node.data.percentChange ?? ""}%`,
            style: {
              stroke: "#183B4E",
              strokeWidth: 2.5,
            },
            markerEnd: {
              type: MarkerType.Arrow,
              color: "#183B4E",
              strokeWidth: 1.5,
            },
            type: "step",
          }));

          setEdges(formattedEdges);
        }
      }
    } else {
      setNodes(defaultNodes);
      setEdges(initialEdges);
    }
  }, [nodesFromVisual, edgesFromVisual, selectedNode]);

  const handleNodeDoubleClick = (event: any, node: Node) => {
    setSelectedNode(node);
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        textAlign: "center",
        position: "relative",
      }}
    >
      <ReactFlowStyled
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        onNodeDoubleClick={handleNodeDoubleClick} // Updated handler
        fitView
      >
        <ControlsStyled />
        <Background gap={12} size={1} />
      </ReactFlowStyled>
    </div>
  );
};

export default ReactFlowComponent;
