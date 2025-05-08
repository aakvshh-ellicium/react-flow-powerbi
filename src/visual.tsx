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
  private readonly target: HTMLElement;
  private readonly root: ReactDOMClient.Root;
  private isDataReady: boolean = false; // flag to check if data is available
  host: any;

  constructor(options: VisualConstructorOptions) {
    this.target = options.element;
    this.root = ReactDOMClient.createRoot(this.target);
    this.host = options.host;

    // Render default nodes immediately
    const defaultNodes: NodeState[] = [
      {
        id: "node1",
        label: "Node 1",
        position: { x: 0, y: 0 },
        percentChange: 100,
      },
      {
        id: "node2",
        label: "Node 2",
        position: { x: 0, y: 150 },
        percentChange: 100,
      },
    ];

    const defaultEdges: Edge[] = [
      {
        id: "node1-node2",
        source: "node1",
        target: "node2",
        type: "default",
      },
    ];

    this.root.render(
      <ReactFlowComponent
        nodesFromVisual={defaultNodes}
        edgesFromVisual={defaultEdges}
        onChartChange={this.debouncedChartChange}
        onEdgesUpdate={this.debouncedEdgesUpdate}
      />
    );
  }

  public update(options: VisualUpdateOptions): void {
    const dataView: DataView = options.dataViews?.[0];
    console.log("options", options);
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
      childValues: any[],
      parentIsMeasure: boolean,
      childIsMeasure: boolean
    ): number {
      const uniqueParentCount = parentIsMeasure
        ? 1
        : new Set(parentValues).size;
      const uniqueChildCount = childIsMeasure ? 1 : new Set(childValues).size;

      if (uniqueParentCount === 0) return 0;

      return +((uniqueChildCount / uniqueParentCount) * 100).toFixed(2);
    }

    const nodes: NodeState[] = columns.map((col, colIndex) => {
      const id = col.queryName;
      const saved = savedNodes.find((n) => n.id === id);
      const isMeasure = col.isMeasure;
      const currentValues = rows.map((row) => row[colIndex]);

      let uniqueCurrent = 0;
      let measureValue = 0;

      if (!isMeasure) {
        uniqueCurrent = new Set(currentValues).size;
      } else {
        // If measure, just pick first value (they are repeated in all rows)
        const measureValues = rows.map((row) => row[colIndex]);
        console.log("measureValues", measureValues)
        measureValue = Number(measureValues.reduce((sum, val) => Number(sum) + (Number(val) || 0), 0));
        uniqueCurrent = 1;
      }

      let incomingEdge: Edge | undefined = undefined;

      if (Array.isArray(savedEdges)) {
        incomingEdge = savedEdges.find((edge) => edge.target === id);
      }

      if (!incomingEdge && colIndex > 0) {
        incomingEdge = {
          id: `${columns[colIndex - 1].queryName}-${id}`,
          source: columns[colIndex - 1].queryName,
          target: id,
          type: "default",
        };
      }

      let percentChange = 100;

      if (incomingEdge) {
        const parentColumnIndex = columns.findIndex(
          (c) => c.queryName === incomingEdge.source
        );
        const parentIsMeasure = columns[parentColumnIndex]?.isMeasure ?? false;

        if (parentColumnIndex >= 0) {
          const parentValues = rows.map((row) => row[parentColumnIndex]);
          let parentUnique = 0;
          let parentMeasureValue = 0;

          if (!parentIsMeasure) {
            parentUnique = new Set(parentValues).size;
          } else {
            parentMeasureValue = Number(parentValues[0]) || 0;
            parentUnique = 1;
          }

          if (isMeasure && parentIsMeasure) {
            // BOTH are measures -> simple percentage ratio
            if (parentMeasureValue !== 0) {
              percentChange = +(
                (measureValue / parentMeasureValue) *
                100
              ).toFixed(2);
            }
          } else if (!isMeasure && !parentIsMeasure) {
            // BOTH are groupings -> unique counts
            if (parentUnique !== 0) {
              percentChange = +((uniqueCurrent / parentUnique) * 100).toFixed(
                2
              );
            }
          } else {
            // Mixed case (one is measure, one is grouping)
            // percentChange = 100;
          }
        }
      }

      return {
        id,
        label: `${col.displayName} (${
          isMeasure ? measureValue : uniqueCurrent
        })`,
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
  private readonly debouncedChartChange = debounce((updatedNodes: NodeState[]) => {
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

  private readonly debouncedEdgesUpdate = debounce((updatedEdges: Edge[]) => {
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
