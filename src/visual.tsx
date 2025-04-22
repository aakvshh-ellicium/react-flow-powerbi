"use strict";

import powerbi from "powerbi-visuals-api";
import VisualConstructorOptions = powerbi.extensibility.visual.VisualConstructorOptions;
import VisualUpdateOptions = powerbi.extensibility.visual.VisualUpdateOptions;
import IVisual = powerbi.extensibility.visual.IVisual;
import DataView = powerbi.DataView;
import { debounce } from "lodash"; // Import lodash debounce
import * as React from "react";
import * as ReactDOMClient from "react-dom/client";

import ReactFlowComponent, { NodeState } from "./component";

import "./../style/visual.less";
import { Edge } from "@xyflow/react";

export class Visual implements IVisual {
  private target: HTMLElement;
  private root: ReactDOMClient.Root;
  private isDataReady: boolean = false; // flag to check if data is available
  host: any;

  constructor(options: VisualConstructorOptions) {
    this.target = options.element;
    this.root = ReactDOMClient.createRoot(this.target);
    this.host = options.host;
  }

  public update(options: VisualUpdateOptions): void {
    const dataView: DataView = options.dataViews?.[0];
    if (!dataView?.table?.rows?.length) return;

    const settings = dataView.metadata.objects?.layout;
    const savedNodePositions = settings?.nodePositions;
    const savedEdgeList = settings?.edgeList;

    let savedNodes: NodeState[] = [];
    let savedEdges: Edge[] = [];

    if (savedNodePositions) {
      try {
        savedNodes = JSON.parse(savedNodePositions as string);
      } catch (e) {
        console.warn("Could not parse saved node positions", e);
      }
    }

    if (savedEdgeList) {
      try {
        savedEdges = JSON.parse(savedEdgeList as string);
      } catch (e) {
        console.warn("Could not parse saved edge list", e);
      }
    }

    if (!Array.isArray(savedEdges)) {
      console.warn("Edges not yet saved, skipping percentChange calculations.");
      return;
    }

    const rows = dataView.table.rows;
    const columns = dataView.table.columns;

    function calculatePercentChange(
      parentValues: any[],
      childValues: any[]
    ): number {
      const uniqueParentCount = new Set(parentValues).size;
      const uniqueChildCount = new Set(childValues).size;

      if (uniqueParentCount === 0) return 0;

      console.log("uniqueParentCount", uniqueParentCount);
      console.log("uniqueChildCount", uniqueChildCount);

      return +((uniqueChildCount / uniqueParentCount) * 100).toFixed(2);
    }

    const nodes: NodeState[] = columns.map((col, colIndex) => {
      const id = col.queryName;
      const currentValues = rows.map((row) => row[colIndex]);
      const saved = savedNodes.find((n) => n.id === id);

      let incomingEdge: Edge | undefined = undefined;

      if (Array.isArray(savedEdges)) {
        incomingEdge = savedEdges.find((edge) => edge.target === id);
      }

      // Ensure new node is handled correctly
      if (!incomingEdge && colIndex > 0) {
        const fallbackEdge: Edge = {
          id: `${columns[colIndex - 1].queryName}-${id}`,
          source: columns[colIndex - 1].queryName,
          target: id,
          type: "default",
        };
        incomingEdge = fallbackEdge;
      }

      let percentChange = 100; // Default percentChange value

      // Ensure recalculation if node is newly added or updated
      if (incomingEdge) {
        console.log("inside 1");
        console.log("columns: ", columns);
        console.log("incomingEdge: ", incomingEdge);
        const parentColumnIndex = columns.findIndex(
          (c) => c.queryName === incomingEdge.source
        );

        if (parentColumnIndex >= 0) {
          console.log("inside 2");

          const parentValues = rows.map((row) => row[parentColumnIndex]);
          percentChange = calculatePercentChange(parentValues, currentValues);
          console.log("percent: ", percentChange);
        }
      } else if (colIndex > 0) {
        console.log("inside 3");

        const parentValues = rows.map((row) => row[colIndex - 1]);
        percentChange = calculatePercentChange(parentValues, currentValues);
      }

      const uniqueCurrent = new Set(currentValues).size;

      return {
        id,
        label: `${col.displayName} (${uniqueCurrent})`,
        position: saved?.position ?? { x: 0, y: colIndex * 150 },
        percentChange,
      };
    });

    // Only render when data is ready
    if (!this.isDataReady) {
      this.isDataReady = true; // Mark data as ready
      // console.log("nodes 1", nodes);
      // console.log("edges 1", savedEdges)
      this.root.render(
        <ReactFlowComponent
          nodesFromVisual={nodes}
          edgesFromVisual={savedEdges}
          onChartChange={this.debouncedChartChange}
          onEdgesUpdate={this.debouncedEdgesUpdate}
        />
      );
    } else {
      // If data is already ready, just update
      // console.log("nodes 2", nodes);
      // console.log("edges 2", savedEdges)
      this.root.render(
        <ReactFlowComponent
          nodesFromVisual={nodes}
          edgesFromVisual={savedEdges}
          onChartChange={this.debouncedChartChange}
          onEdgesUpdate={this.debouncedEdgesUpdate}
        />
      );
    }
  }

  public destroy(): void {
    this.root.unmount();
  }

  // Create debounced versions of onChartChange and onEdgesUpdate
  private debouncedChartChange = debounce((updatedNodes: NodeState[]) => {
    this.host.persistProperties({
      merge: [
        {
          objectName: "layout",
          selector: null,
          properties: {
            nodePositions: JSON.stringify(updatedNodes),
          },
        },
      ],
    });
  }, 500); // 500ms debounce time, adjust as needed

  private debouncedEdgesUpdate = debounce((updatedEdges: Edge[]) => {
    this.host.persistProperties({
      merge: [
        {
          objectName: "layout",
          selector: null,
          properties: {
            edgeList: JSON.stringify(updatedEdges),
          },
        },
      ],
    });
  }, 500); // 500ms debounce time, adjust as needed
}
