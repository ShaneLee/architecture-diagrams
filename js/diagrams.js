const PADDING_FROM_EDGE = 50;

function createCustomDiagram(svgSelector, data, darkMode = false) {
  const svg = d3.select(svgSelector);

  const backgroundColor = darkMode ? "#333" : "#fff";
  const nodeColor = darkMode ? "#555" : "#69b3a2";
  const textColor = darkMode ? "#fff" : "#000";
  const linkColor = darkMode ? "#777" : "#999";
  const flowColor = darkMode ? "#f00" : "red";

  svg.style("background-color", backgroundColor);

  const { nodes, links } = data;

  const defaultNodeSize = 120;
  const defaultStrokeColor = "#000";
  const defaultStrokeWidth = 2;
  const nodeSizeMap = new Map();

  nodes.forEach((node) => {
    const textLength = node.id.length * 7;
    const size = Math.max(textLength, node.size || defaultNodeSize);
    nodeSizeMap.set(node.id, size);
  });

  const leftmostNode = nodes.find((d) => d.leftmostNode);
  const rightmostNode = nodes.find((d) => d.rightmostNode);

  const svgWidth = +svg.attr("width") - PADDING_FROM_EDGE;
  const svgHeight = +svg.attr("height") - PADDING_FROM_EDGE;

  if (leftmostNode) {
    const leftmostSize = nodeSizeMap.get(leftmostNode.id) || defaultNodeSize;
    leftmostNode.x = PADDING_FROM_EDGE + leftmostSize / 2;
    leftmostNode.y = svgHeight / 2;
  }

  if (rightmostNode) {
    const rightmostSize = nodeSizeMap.get(rightmostNode.id) || defaultNodeSize;
    rightmostNode.x = svgWidth - PADDING_FROM_EDGE - rightmostSize / 2;
    rightmostNode.y = svgHeight / 2;
  }

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(150)
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(300, 200))
    .force(
      "collide",
      d3.forceCollide().radius((d) => (d.size || 120) / 2 + 10) // Prevent overlapping
    )
    .on("tick", ticked);

  const link = svg
    .append("g")
    .attr("class", "links")
    .selectAll("line")
    .data(links)
    .enter()
    .append("line")
    .attr("stroke-width", (d) => d.style.strokeWidth || 2)
    .attr("stroke", (d) => d.style.stroke || linkColor)
    .attr("stroke-dasharray", (d) => d.style.dasharray || "0");

  // Create a dedicated layer for flow circles between links and nodes
  const flowLayer = svg.append("g").attr("class", "flows");

  const node = svg
    .append("g")
    .attr("class", "nodes")
    .selectAll("g")
    .data(nodes)
    .enter()
    .append("g")
    .call(
      d3
        .drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    );

  node.each(function (d) {
    const textLength = d.id.length * 7;
    const size = Math.max(textLength, d.size || defaultNodeSize);

    const strokeColor = d.strokeColor || defaultStrokeColor;
    const strokeWidth = d.strokeWidth || defaultStrokeWidth;

    if (d.shape === "circle") {
      d3.select(this)
        .append("circle")
        .attr("r", size / 2) // Make radius proportional to text
        .attr("fill", d.color || nodeColor)
        .attr("stroke", strokeColor)
        .attr("stroke-width", strokeWidth);
    } else if (d.shape === "rect") {
      d3.select(this)
        .append("rect")
        .attr("width", size)
        .attr("height", size / 2)
        .attr("fill", d.color || nodeColor)
        .attr("x", -(size / 2)) // Center the rectangle
        .attr("y", -(size / 4))
        .attr("rx", 10) // Rounded corners
        .attr("ry", 10) // Rounded corners
        .attr("stroke", strokeColor)
        .attr("stroke-width", strokeWidth);
    }
  });

  node
    .append("text")
    .attr("x", 0)
    .attr("y", 5)
    .attr("text-anchor", "middle")
    .text((d) => d.id)
    .attr("font-size", "12px")
    .style("font-family", "sans-serif")
    .attr("fill", textColor);

  function propagateFlow(sourceNode, targetNode, resetOrigin) {
    const flowCircle = flowLayer
      .append("circle")
      .attr("class", "flow")
      .attr("r", 5)
      .attr("fill", flowColor)
      .attr("cx", sourceNode.x)
      .attr("cy", sourceNode.y);

    function animateFlow() {
      flowCircle
        .attr("cx", sourceNode.x) // Reset x position
        .attr("cy", sourceNode.y) // Reset y position
        .transition()
        .duration(2000)
        .attr("cx", targetNode.x) // Ending x position
        .attr("cy", targetNode.y) // Ending y position
        .on("end", function () {
          d3.select(this).remove();

          const childLinks = links.filter((l) => l.source.id === targetNode.id);

          if (childLinks.length > 0) {
            childLinks.forEach((link) =>
              propagateFlow(targetNode, link.target, resetOrigin)
            );
          } else {
            if (resetOrigin) {
              setTimeout(function () {
                propagateFlow(resetOrigin, resetOrigin, resetOrigin);
              }, 500);
            }
          }
        });
    }

    animateFlow();
  }

  // Identify nodes with 'dataProducing = true' and initiate the flow
  nodes.forEach((node) => {
    console.log(node);
    if (node.dataProducing) {
      // Find all outgoing links from this node
      const outgoingLinks = links.filter((l) => l.source.id === node.id);
      outgoingLinks.forEach((link) => propagateFlow(node, link.target, node));
    }
  });

  function ticked() {
    const svgWidth = +svg.attr("width") - PADDING_FROM_EDGE;
    const svgHeight = +svg.attr("height") - PADDING_FROM_EDGE;

    // Update link positions
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("transform", function (d) {
      d.x = Math.max(PADDING_FROM_EDGE, Math.min(svgWidth, d.x));
      d.y = Math.max(PADDING_FROM_EDGE, Math.min(svgHeight, d.y));
      return "translate(" + d.x + "," + d.y + ")";
    });
  }

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart();
    d.fx = d.x;
    d.fy = d.y;
  }

  function dragged(event, d) {
    // Minus 20 is padding around the edge
    const svgWidth = +svg.attr("width") - PADDING_FROM_EDGE;
    const svgHeight = +svg.attr("height") - PADDING_FROM_EDGE;

    d.fx = Math.max(PADDING_FROM_EDGE, Math.min(svgWidth, event.x));
    d.fy = Math.max(PADDING_FROM_EDGE, Math.min(svgHeight, event.y));
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0);
    d.fx = null;
    d.fy = null;
  }
}

function buildDiagramData(services) {
  const nodes = [];
  const links = [];

  const typeToShapeAndColor = {
    frontend: { shape: "circle", color: "#a1d99b" },
    gateway: { shape: "rect", color: "#66b3ff" },
    infrastructure: { shape: "circle", color: "#ffcc00" },
    backend: { shape: "rect", color: "#d62728" },
    storage: { shape: "rect", color: "#9467bd" },
  };

  services.forEach((service) => {
    const { shape, color } = typeToShapeAndColor[service.type] || {
      shape: "circle",
      color: "#69b3a2",
    };

    nodes.push({
      id: service.id,
      shape: shape,
      color: color,
      strokeColor: service.strokeColor || "#000",
      strokeWidth: service.strokeWidth || 2,
      dataProducing: service.dataProducing || false,
      leftmostNode: service.leftmostNode,
      rightmostNode: service.rightmostNode,
    });

    service.talksTo.forEach((talk) => {
      talk.sendsTo.forEach((send) => {
        links.push({
          source: service.id,
          target: send.id,
          style: { stroke: "#a1d99b", strokeWidth: 2 },
        });
      });

      talk.consumesFrom.forEach((consume) => {
        links.push({
          source: consume.id,
          target: service.id,
          style: { stroke: "#9467bd", strokeWidth: 2 },
        });
      });
    });
  });

  return { nodes, links };
}

const services = [
  {
    id: "Client",
    dataProducing: true,
    leftmostNode: true,
    type: "frontend",
    talksTo: [
      {
        id: "API Gateway",
        sendsTo: [{ id: "API Gateway", via: "REST" }],
        consumesFrom: [],
      },
    ],
  },
  {
    id: "API Gateway",
    type: "gateway",
    talksTo: [
      {
        id: "Service Mesh",
        sendsTo: [{ id: "Service Mesh", via: "REST" }],
        consumesFrom: [],
      },
    ],
  },
  {
    id: "Service Mesh",
    type: "infrastructure",
    talksTo: [
      {
        id: "Service 1",
        sendsTo: [{ id: "Service 1", via: "REST" }],
        consumesFrom: [],
      },
      {
        id: "Service 2",
        sendsTo: [{ id: "Service 2", via: "REST" }],
        consumesFrom: [],
      },
    ],
  },
  {
    id: "Service 1",
    type: "backend",
    talksTo: [
      {
        id: "Database",
        sendsTo: [{ id: "Database", via: "REST" }],
        consumesFrom: [{ id: "Service 2", via: "messaging" }],
      },
    ],
  },
  {
    id: "Service 2",
    type: "backend",
    talksTo: [
      {
        id: "Database",
        sendsTo: [{ id: "Database", via: "REST" }],
        consumesFrom: [],
      },
    ],
  },
  {
    id: "Database",
    rightmostNode: true,
    type: "storage",
    talksTo: [],
  },
];

window.addEventListener("load", (event) => {
  const diagramData = buildDiagramData(services);
  createCustomDiagram("svg", diagramData, true);
});

// TODO option to prefer grid layout
// TODO colour mapping
// TODO rest / messaging shapes?
