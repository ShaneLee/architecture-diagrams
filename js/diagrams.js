// Gruvbox theme source https://github.com/morhetz/gruvbox
// Hypergruv box https://github.com/mcchrish/hyperterm-gruvbox-dark/tree/master
class GruvBoxDarkTheme {
  constructor() {
    this.fg = '#ebdbb2'
    this.bg = '#282828'
    this.black = '#928374'
    this.red = '#fb4934'
    this.green = '#b8bb26'
    this.yellow = '#fabd2f'
    this.blue = '#83a598'
    this.magenta = '#d3869b'
    this.cyan = '#8ec07c'
    this.white = '#fbf1c7'
    this.lightBlack = '#ebdbb2'
    this.lightRed = '#cc241d'
    this.lightGreen = '#98971a'
    this.lightYellow = '#d79921'
    this.lightBlue = '#458588'
    this.lightMagenta = '#b16286'
    this.lightCyan = '#689d6a'
    this.lightWhite = '#a89984'
  }
}
gruvBoxDarkTheme = new GruvBoxDarkTheme()

class Solarised {
  constructor() {
    this.fg = '#839496'
    this.bg = '#002b36'
    this.black = '#073642'
    this.red = '#dc322f'
    this.green = '#859900'
    this.yellow = '#b58900'
    this.blue = '#268bd2'
    this.magenta = '#d33682'
    this.cyan = '#2aa198'
    this.white = '#eee8d5'
    this.lightBlack = '#586e75'
    this.lightRed = '#cb4b16'
    this.lightGreen = '#586e75'
    this.lightYellow = '#657b83'
    this.lightBlue = '#839496'
    this.lightMagenta = '#6c71c4'
    this.lightCyan = '#93a1a1'
    this.lightWhite = '#fdf6e3'
  }
}

solarised = new Solarised()

const PADDING_FROM_EDGE = 50

function createCustomDiagram(svgSelector, data) {
  const svg = d3.select(svgSelector)
  const svgWidth = +svg.attr('width')
  const svgHeight = +svg.attr('height')
  const theme = darkMode ? gruvBoxDarkTheme : solarised

  const backgroundColor = theme.bg
  const nodeColor = theme.lightWhite
  const textColor = theme.bg
  const linkColor = theme.fg
  const flowColor = theme.red

  svg.style('background-color', backgroundColor)

  const { nodes, links } = data

  const defaultNodeSize = 120
  const defaultStrokeColor = theme.black
  const defaultStrokeWidth = 2

  nodes.forEach(node => {
    const textLength = node.id.length * 7
    node.size = Math.max(textLength, node.size || defaultNodeSize)
  })

  const leftmostNode = nodes.find(d => d.leftmostNode)
  const rightmostNode = nodes.find(d => d.rightmostNode)

  if (leftmostNode) {
    leftmostNode.x = PADDING_FROM_EDGE + leftmostNode.size / 2
    leftmostNode.y = svgHeight / 2
  }

  if (rightmostNode) {
    rightmostNode.x = svgWidth - PADDING_FROM_EDGE - rightmostNode.size / 2
    rightmostNode.y = svgHeight / 2
  }

  const simulation = d3
    .forceSimulation(nodes)
    .force(
      'link',
      d3
        .forceLink(links)
        .id(d => d.id)
        .distance(150),
    )
    .force('charge', d3.forceManyBody().strength(-300))
    .force('center', d3.forceCenter(svgWidth / 2, svgHeight / 2))
    .force(
      'collide',
      d3.forceCollide().radius(d => d.size / 2 + 10), // Prevent overlapping
    )
    .on('tick', ticked)

  const link = svg
    .append('g')
    .attr('class', 'links')
    .selectAll('line')
    .data(links)
    .enter()
    .append('line')
    .attr('stroke-width', d => d.style.strokeWidth || 2)
    .attr('stroke', d => d.style.stroke || linkColor)
    .attr('stroke-dasharray', d => d.style.dasharray || '0')

  const flowLayer = svg.append('g').attr('class', 'flows')

  const node = svg
    .append('g')
    .attr('class', 'nodes')
    .selectAll('g')
    .data(nodes)
    .enter()
    .append('g')
    .call(d3.drag().on('start', dragstarted).on('drag', dragged).on('end', dragended))

  node.each(function (d) {
    const el = d3.select(this)
    const strokeColor = d.strokeColor || defaultStrokeColor
    const strokeWidth = d.strokeWidth || defaultStrokeWidth

    if (d.shape === 'circle') {
      el.append('circle')
        .attr('r', d.size / 2)
        .attr('fill', d.color || nodeColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
    } else if (d.shape === 'rect') {
      el.append('rect')
        .attr('width', d.size)
        .attr('height', d.size / 2)
        .attr('fill', d.color || nodeColor)
        .attr('x', -(d.size / 2))
        .attr('y', -(d.size / 4))
        .attr('rx', 10)
        .attr('ry', 10)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
    } else if (d.shape === 'database') {
      el.append('ellipse')
        .attr('cx', 0)
        .attr('cy', -(d.size / 4))
        .attr('rx', d.size / 2)
        .attr('ry', d.size / 8)
        .attr('fill', d.color || nodeColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)

      el.append('rect')
        .attr('width', d.size)
        .attr('height', d.size / 2)
        .attr('x', -(d.size / 2))
        .attr('y', -(d.size / 4))
        .attr('fill', d.color || nodeColor)
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)

      el.append('path')
        .attr('d', `M${-d.size / 2},0 A${d.size / 2},${d.size / 8} 0 0,0 ${d.size / 2},0`)
        .attr('fill', 'none')
        .attr('stroke', strokeColor)
        .attr('stroke-width', strokeWidth)
    }
  })

  node
    .append('text')
    .attr('x', 0)
    .attr('y', 5)
    .attr('text-anchor', 'middle')
    .text(d => d.id)
    .attr('font-size', '12px')
    .style('font-family', 'sans-serif')
    .attr('fill', textColor)

  function propagateFlow(sourceNode, targetNode, resetOrigin) {
    const flowCircle = flowLayer
      .append('circle')
      .attr('class', 'flow')
      .attr('r', 5)
      .attr('fill', flowColor)
      .attr('cx', sourceNode.x)
      .attr('cy', sourceNode.y)

    animateFlow(flowCircle, sourceNode, targetNode, resetOrigin)
  }

  function animateFlow(flowCircle, sourceNode, targetNode, resetOrigin) {
    flowCircle
      .attr('cx', sourceNode.x)
      .attr('cy', sourceNode.y)
      .transition()
      .duration(2000)
      .attr('cx', targetNode.x)
      .attr('cy', targetNode.y)
      .on('end', function () {
        d3.select(this).remove()
        const childLinks = links.filter(l => l.source.id === targetNode.id)
        if (childLinks.length > 0) {
          childLinks.forEach(link => propagateFlow(targetNode, link.target, resetOrigin))
        } else if (resetOrigin) {
          setTimeout(() => propagateFlow(resetOrigin, resetOrigin, resetOrigin), 500)
        }
      })
  }

  nodes.forEach(node => {
    if (node.dataProducing) {
      const outgoingLinks = links.filter(l => l.source.id === node.id)
      outgoingLinks.forEach(link => propagateFlow(node, link.target, node))
    }
  })

  function ticked() {
    link
      .attr('x1', d => d.source.x)
      .attr('y1', d => d.source.y)
      .attr('x2', d => d.target.x)
      .attr('y2', d => d.target.y)

    node.attr('transform', function (d) {
      d.x = Math.max(d.size / 2, Math.min(svgWidth - d.size / 2, d.x))
      d.y = Math.max(d.size / 2, Math.min(svgHeight - d.size / 2, d.y))
      return `translate(${d.x},${d.y})`
    })
  }

  function dragstarted(event, d) {
    if (!event.active) simulation.alphaTarget(0.3).restart()
    d.fx = d.x
    d.fy = d.y
  }

  function dragged(event, d) {
    d.fx = event.x
    d.fy = event.y
  }

  function dragended(event, d) {
    if (!event.active) simulation.alphaTarget(0)
    d.fx = null
    d.fy = null
  }
}

function buildDiagramData(services) {
  const theme = darkMode ? gruvBoxDarkTheme : solarised
  const nodes = []
  const links = []

  const typeToShapeAndColor = {
    frontend: { shape: 'rect', color: theme.magenta },
    gateway: { shape: 'rect', color: theme.yellow },
    infrastructure: { shape: 'circle', color: theme.lightWhite },
    backend: { shape: 'rect', color: theme.green },
    storage: { shape: 'database', horizontal: false, color: theme.blue },
  }

  services.forEach(service => {
    const { shape, color } = typeToShapeAndColor[service.type] || {
      shape: 'circle',
      color: theme.cyan,
    }

    nodes.push({
      id: service.id,
      shape: shape,
      color: color,
      strokeColor: service.strokeColor || theme.black,
      strokeWidth: service.strokeWidth || 2,
      dataProducing: service.dataProducing || false,
      leftmostNode: service.leftmostNode,
      rightmostNode: service.rightmostNode,
    })

    if (service.talksTo) {
      service.talksTo.forEach(talk => {
        if (talk.sendsTo) {
          talk.sendsTo.forEach(send => {
            links.push({
              source: service.id,
              target: send.id,
              style: { stroke: theme.cyan, strokeWidth: 2 },
            })
          })
        }

        if (talk.consumesFrom) {
          talk.consumesFrom.forEach(consume => {
            links.push({
              source: consume.id,
              target: service.id,
              style: { stroke: theme.lightMagenta, strokeWidth: 2 },
            })
          })
        }
      })
    }
  })

  return { nodes, links }
}

function downloadFile(content, fileName, contentType) {
  const a = document.createElement('a')
  const file = new Blob([content], { type: contentType })
  a.href = URL.createObjectURL(file)
  a.download = fileName
  a.click()
  URL.revokeObjectURL(a.href)
}

function saveDiagramToFile() {
  const { nodes, links } = buildDiagramData(services)
  const exportedJson = exportDiagramData(nodes, links)
  downloadFile(exportedJson, 'diagram-config.json', 'application/json')
}

function exportDiagramData(nodes, links) {
  const data = { nodes, links }
  const json = JSON.stringify(data, null, 2)
  console.log('Exported JSON:', json)
  return json
}

function importDiagramData(jsonString) {
  const data = JSON.parse(jsonString)
  if (data.nodes && data.links) {
    createCustomDiagram('svg', data)
  } else {
    console.error('Invalid diagram data.')
  }
}

function clearDiagram() {
  d3.select('svg').selectAll('*').remove()
}

function loadDiagram(savedJson) {
  clearDiagram()
  importDiagramData(savedJson)
}

function readFile(file, callback) {
  const reader = new FileReader()
  reader.onload = function (event) {
    const content = event.target.result
    callback(content)
  }
  reader.readAsText(file)
}

function uploadDiagramFile(event) {
  const file = event.target.files[0]
  if (file) {
    readFile(file, function (content) {
      loadDiagram(content)
    })
  }
}

const darkMode = true
