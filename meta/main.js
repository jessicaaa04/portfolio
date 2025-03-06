let data = [];
let commits = [];
let files = [];
let selectedCommits = [];

// We'll store references for the scatterplot so we can update smoothly
let svg, plotWidth, plotHeight, xAxisGroup, yAxisGroup, dotsGroup;

// Keep your existing margin, width, height, and color scales
const width = 1000,
      height = 600,
      margin = { top: 50, right: 30, bottom: 70, left: 70 };

const colorScale = d3.scaleSequential()
    .domain([0, 24])
    .interpolator(d3.interpolateRgbBasis(["#4b74ff", "#ffba42"]));

let xScale, yScale;

/*******************************************************
 * 1) LOAD & PROCESS DATA
 *******************************************************/
async function loadData() {
    try {
        data = await d3.csv('../meta/loc.csv', (row) => ({
            ...row,
            file: row.file,
            line: Number(row.line),
            depth: Number(row.depth),
            length: Number(row.length),
            // Use full ISO string from row.datetime
            datetime: new Date(row.datetime),
        }));

        if (data.length > 0) {
            processCommits();
            processFiles();
        } else {
            console.warn("No data loaded from loc.csv.");
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

function processCommits() {
    if (!data.length) {
        console.warn("No data available to process commits.");
        return;
    }

    commits = d3.groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            const first = lines[0];
            const { author, date, time, timezone, datetime } = first;

            if (!datetime || isNaN(datetime)) {
                console.warn("Invalid datetime detected:", commit, datetime);
            }

            return {
                id: commit,
                url: `https://github.com/YOUR_REPO/commit/${commit}`,
                author,
                date,
                time,
                timezone,
                datetime,
                hourFrac: datetime ? datetime.getHours() + datetime.getMinutes() / 60 : 0,
                totalLines: lines.length,
                lines: lines.map(d => ({ file: d.file, type: d.type, length: d.length })),
            };
        });
    commits.sort((a, b) => d3.ascending(a.datetime, b.datetime));
}

function processFiles() {
    if (!data.length) {
        console.warn("No data available to process files.");
        return;
    }

    files = d3.groups(data, d => d.file)
        .map(([name, lines]) => ({
            name,
            lines,
            totalLines: lines.length,
            lastUpdated: d3.max(lines, d => d.datetime)
        }));

    files.sort((a, b) => d3.ascending(a.lastUpdated, b.lastUpdated));
}


/*******************************************************
 * 2) TOOLTIP HELPERS
 *******************************************************/
function updateTooltipContent(commit) {
    if (!commit || Object.keys(commit).length === 0) {
        console.warn("No valid commit provided to update tooltip.", commit);
        return;
    }

    const link = document.getElementById('commit-link');
    const date = document.getElementById('commit-date');
    const author = document.getElementById('commit-author');
    const lines = document.getElementById('commit-lines');

    link.href = commit.url;
    link.textContent = commit.id || "Unknown ID";
    date.textContent = commit.datetime
        ? commit.datetime.toLocaleString('en', { dateStyle: 'full' })
        : "Unknown Date";
    author.textContent = commit.author || "Unknown Author";
    lines.textContent = commit.totalLines || "0";
}

function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
}

/*******************************************************
 * 3) STATISTICS
 *******************************************************/
function displayStats(filteredCommits = commits) {
    if (!filteredCommits.length) {
        console.warn("No data available for displaying stats.");
        return;
    }

    let container = d3.select('.stats-container');
    if (container.empty()) {
        container = d3.select('#stats')
            .append('div')
            .attr('class', 'stats-container');
    }

    container.selectAll('*').remove();

    const dl = container.append('dl').attr('class', 'stats-dl');

    // (a) Total Commits
    dl.append('dt').text('Total Commits');
    dl.append('dd').text(filteredCommits.length);

    // (b) Total Files
    const filteredLines = filteredCommits.flatMap(d => d.lines);
    const uniqueFiles = new Set(filteredLines.map(d => d.file));
    dl.append('dt').text('Total Files');
    dl.append('dd').text(uniqueFiles.size);

    // (c) Most Active Time of Day
    const workByPeriod = d3.rollups(
        filteredCommits,
        v => v.length,
        d => new Date(d.datetime).toLocaleString('en', { hour: 'numeric', hour12: true })
    );
    const mostActiveTime = d3.greatest(workByPeriod, d => d[1])?.[0] || "Unknown";
    dl.append('dt').text('Most Active Time of Day');
    dl.append('dd').text(mostActiveTime);

    // (d) Most Active Day of the Week
    const workByDay = d3.rollups(
        filteredCommits,
        v => v.length,
        d => new Date(d.datetime).toLocaleString('en', { weekday: 'long' })
    );
    const mostActiveDay = d3.greatest(workByDay, d => d[1])?.[0] || "Unknown";
    dl.append('dt').text('Most Active Day of the Week');
    dl.append('dd').text(mostActiveDay);
}

/*******************************************************
 * 4) SCATTERPLOT SETUP + UPDATE
 *******************************************************/
function initScatterplot() {
    const container = document.querySelector('.chart-container');
    const containerWidth = container ? container.clientWidth : 600; 
    const containerHeight = 600; 

    svg = d3.select('#chart')
      .append('svg')
      .attr('width', containerWidth)
      .attr('height', containerHeight)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    plotWidth = containerWidth - margin.left - margin.right;
    plotHeight = containerHeight - margin.top - margin.bottom;

    xScale = d3.scaleTime()
      .range([0, plotWidth])
      .nice();

    yScale = d3.scaleLinear()
      .domain([0, 24])
      .range([plotHeight, 0]);

    xAxisGroup = svg.append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${plotHeight})`);

    yAxisGroup = svg.append('g')
      .attr('class', 'y-axis');

    dotsGroup = svg.append('g')
      .attr('class', 'dots');

    svg.append("g")
      .attr("class", "gridlines")
      .call(
          d3.axisLeft(yScale)
            .tickFormat("")
            .tickSize(-plotWidth)
      );
}

function updateScatterplot(filteredCommits) {
    if (!filteredCommits || !filteredCommits.length) {
        dotsGroup.selectAll('circle').interrupt().remove();
        xAxisGroup.interrupt().call(d3.axisBottom(xScale).ticks(0));
        yAxisGroup.interrupt().call(d3.axisLeft(yScale).ticks(0));
        return;
    }

    // Interrupt any ongoing transitions to prevent overlapping updates
    dotsGroup.selectAll('circle').interrupt();
    xAxisGroup.interrupt();
    yAxisGroup.interrupt();
    svg.select(".gridlines").interrupt();

    // Always update xScale domain to exactly match the visible commits
    const newExtent = d3.extent(filteredCommits, d => d.datetime);
    xScale.domain(newExtent).nice();

    const [minLines, maxLines] = d3.extent(filteredCommits, d => d.totalLines);
    const rScale = d3.scaleSqrt()
        .domain([minLines || 0, maxLines || 0])
        .range([2, 12]);

    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%b %d"))
        .ticks(10);

    xAxisGroup.transition()
      .duration(500)
      .call(xAxis)
      .selectAll("text")
      .style("text-anchor", "end")
      .attr("transform", "rotate(-30)")
      .style("font-size", "12px");

    const yAxis = d3.axisLeft(yScale)
        .tickFormat(d => String(d % 24).padStart(2, '0') + ':00');

    yAxisGroup.transition()
      .duration(500)
      .call(yAxis);

    svg.select(".gridlines").transition()
      .duration(500)
      .call(
          d3.axisLeft(yScale)
            .tickFormat("")
            .tickSize(-plotWidth)
      );

    const sortedCommits = d3.sort(filteredCommits, d => -d.totalLines);
    const circles = dotsGroup.selectAll('circle')
      .data(sortedCommits, d => d.id);

    circles.exit()
      .transition()
      .duration(500)
      .attr('r', 0)
      .remove();

    const enter = circles.enter()
      .append('circle')
      .attr('cx', d => xScale(d.datetime))
      .attr('cy', d => yScale(d.hourFrac))
      .attr('r', 0)
      .style("fill-opacity", 0.7)
      .attr('fill', d => colorScale(d.hourFrac))
      .on('mouseenter', (event, commit) => {
          updateTooltipContent(commit);
          updateTooltipVisibility(true);
          updateTooltipPosition(event);
          d3.select(event.currentTarget).style("fill-opacity", 1);
      })
      .on('mousemove', (event) => updateTooltipPosition(event))
      .on('mouseleave', (event) => {
          updateTooltipVisibility(false);
          d3.select(event.currentTarget).style("fill-opacity", 0.7);
      });

    enter.transition()
      .duration(500)
      .attr('r', d => rScale(d.totalLines));

    circles.merge(enter)
      .transition()
      .duration(500)
      .attr('cx', d => xScale(d.datetime))
      .attr('cy', d => yScale(d.hourFrac))
      .attr('r', d => rScale(d.totalLines));

    if (svg.select('.brush').empty()) {
        brushSelector(svg);
    }
}

/*******************************************************
 * 5) BRUSH & SELECTION
 *******************************************************/
function isCommitSelected(commit) {
    return selectedCommits.includes(commit);
}

function brushSelector(parentG) {
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("start brush end", brushed);

    parentG.append("g")
        .attr("class", "brush")
        .call(brush);

    parentG.selectAll(".dots").raise();
}

function brushed(event) {
    const selection = event.selection;
    if (!selection) {
        selectedCommits = [];
    } else {
        const [[x0, y0], [x1, y1]] = selection;
        selectedCommits = commits.filter(commit => {
            const cx = xScale(commit.datetime);
            const cy = yScale(commit.hourFrac);
            return (cx >= x0 && cx <= x1 && cy >= y0 && cy <= y1);
        });
    }
    updateSelection();
    updateSelectionCount();
    updateLanguageBreakdown();
}

function updateSelection() {
    d3.selectAll("circle")
        .classed("selected", d => isCommitSelected(d))
        .attr("fill", d => isCommitSelected(d) ? "#ff6b6b" : colorScale(d.hourFrac));
}

function updateSelectionCount() {
    const countElement = document.getElementById("selection-count");
    countElement.textContent = selectedCommits.length
        ? `${selectedCommits.length} commits selected`
        : "No commits selected";
}

function updateLanguageBreakdown() {
    const container = document.getElementById('language-breakdown');

    // If there are no selectedCommits, show "No language breakdown available"
    if (!selectedCommits.length) {
        container.innerHTML = '<p>No language breakdown available</p>';
        return;
    }

    // Otherwise, proceed with only the selected commits
    const lines = selectedCommits.flatMap(d => d.lines || []);
    if (!lines.length) {
        container.innerHTML = '<p>No language data available</p>';
        return;
    }

    const breakdown = d3.rollup(
        lines,
        v => v.length,
        d => d.type || "Unknown"
    );

    container.innerHTML = `
        <h3>Language Breakdown</h3>
        <div class="language-row"></div>
    `;
    const rowContainer = container.querySelector(".language-row");

    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1%')(proportion);
        rowContainer.innerHTML += `
            <div class="language-item">
                <strong>${language}:</strong> ${count} lines (${formatted})
            </div>
        `;
    }
}
/*******************************************************
 * 6) FILE VISUALIZATION
 *******************************************************/
function updateFileVisualization(filteredCommits) {
    if (!filteredCommits || !filteredCommits.length) {
        d3.select("#file-visualization").html("<p>No files edited</p>");
        return;
    }

    const lines = filteredCommits.flatMap(d => d.lines);

    const fileTypeColors = d3.scaleOrdinal()
        .domain([...new Set(lines.map(l => l.type))])
        .range(d3.schemeTableau10);

    const files = d3.groups(lines, d => d.file).map(([name, lines]) => ({
        name,
        lines
    }));

    files.sort((a, b) => d3.descending(a.lines.length, b.lines.length));

    const container = d3.select("#file-visualization");
    container.html("");

    const dl = container.append("dl").attr("class", "files");

    const fileItems = dl.selectAll("div.file-block")
        .data(files)
        .enter()
        .append("div")
        .attr("class", "file-block");

    fileItems.append("dt")
        .html(d => `
            <code>${d.name}</code>
            <small>(${d.lines.length} lines)</small>
        `);

    const dd = fileItems.append("dd");
    dd.selectAll("div.line")
        .data(d => d.lines)
        .enter()
        .append("div")
        .attr("class", "line")
        .style("background", line => fileTypeColors(line.type));
}

/*******************************************************
 * 7) SCROLLY LOGIC (Step 4.3) - Commits Scrolly
 *******************************************************/
let ITEM_HEIGHT = 50;      // height (px) per commit item
let VISIBLE_COUNT = 10;    // number of commit items to show
let startIndex = 0;
let endIndex = 0;
let scrollContainer;
let itemsContainer;
let scrollTimeout;         // For debouncing the scroll event

function initScrolly() {
    itemsContainer = d3.select('#items-container');
    if (itemsContainer.empty()) {
        console.error("Error: #items-container not found in the DOM.");
        return;
    }

    const NUM_ITEMS = commits.length;
    const totalHeight = NUM_ITEMS * ITEM_HEIGHT;

    scrollContainer = d3.select('#scroll-container');
    if (scrollContainer.empty()) {
        console.error("Error: #scroll-container not found.");
        return;
    }

    d3.select('#spacer').style('height', `${totalHeight}px`);

    startIndex = 0;
    endIndex = Math.min(VISIBLE_COUNT, NUM_ITEMS);

    renderItems(startIndex);

    // 300ms debounce for smoother updates
    scrollContainer.on('scroll', onScroll);
}

function onScroll() {
    if (scrollTimeout) clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
        const scrollTop = scrollContainer.node().scrollTop;
        let newStartIndex = Math.floor(scrollTop / ITEM_HEIGHT);
        newStartIndex = Math.max(0, Math.min(newStartIndex, commits.length - VISIBLE_COUNT));
        
        if (newStartIndex !== startIndex) {
            startIndex = newStartIndex;
            endIndex = startIndex + VISIBLE_COUNT;

            renderItems(startIndex);

            const visibleCommits = commits.slice(startIndex, endIndex);
            updateScatterplot(visibleCommits);
            // REMOVE THIS LINE TO PREVENT FILE VISUALIZATION FROM UPDATING
            // updateFileVisualization(visibleCommits);
            displayStats(visibleCommits);
        }
    }, 300);
}


function renderItems(startIndex) {
    if (!itemsContainer) {
        console.error("Error: itemsContainer is not defined. Make sure initScrolly() is called.");
        return;
    }

    if (!commits.length) {
        console.warn("No commits to render!");
        return;
    }

    const endIndex = Math.min(startIndex + VISIBLE_COUNT, commits.length);
    const newCommitSlice = commits.slice(startIndex, endIndex);

    let items = itemsContainer.selectAll('.item')
        .data(newCommitSlice, d => d.id);

    items.exit().remove();

    const enterItems = items.enter()
        .append('div')
        .attr('class', 'item')
        .style('position', 'relative')
        .style('opacity', 0)
        .html(commit => `
            <p>
              <strong>${commit.datetime.toLocaleString('en', { dateStyle: "full", timeStyle: "short" })}</strong>, 
              I made a commit. I edited <strong>${commit.totalLines} line(s)</strong>. 
              Then I looked over all I had made, and I saw that it was very good.
            </p>
        `);

    enterItems.transition()
        .duration(200)
        .style('opacity', 1);

    items = enterItems.merge(items);
    items.style('top', (_, idx) => `${(startIndex + idx) * ITEM_HEIGHT}px`);
}

/*******************************************************
 * 7b) SCROLLY LOGIC - Files Scrolly
 *******************************************************/
let FILE_ITEM_HEIGHT = 50;  // height (px) per file item
let FILE_VISIBLE_COUNT = 5; // number of file items to show
let fileStartIndex = 0;
let fileEndIndex = 0;
let fileScrollContainer;
let fileItemsContainer;
let fileScrollTimeout; // For debouncing

function initScrollyFiles() {
    fileItemsContainer = d3.select('#files-items-container');
    fileScrollContainer = d3.select('#files-scroll-container');

    if (fileItemsContainer.empty() || fileScrollContainer.empty()) {
        console.error("Error: #files-items-container or #files-scroll-container not found.");
        return;
    }

    const NUM_FILES = files.length;
    if (NUM_FILES === 0) {
        console.warn("No files available for scrolling.");
        return;
    }

    d3.select('#files-spacer').style('height', `${NUM_FILES * FILE_ITEM_HEIGHT}px`);

    fileStartIndex = 0;
    fileEndIndex = Math.min(FILE_VISIBLE_COUNT, NUM_FILES);

    renderFileItems(fileStartIndex);

    console.log("Binding file scroll event...");

    fileScrollContainer.on('scroll', () => {
        console.log("File scroll detected! Running onScrollFiles...");
        onScrollFiles();
    });
}


function onScrollFiles() {
    if (fileScrollTimeout) clearTimeout(fileScrollTimeout);
    fileScrollTimeout = setTimeout(() => {
        const scrollTop = fileScrollContainer.node().scrollTop;
        let newStartIndex = Math.floor(scrollTop / FILE_ITEM_HEIGHT);
        newStartIndex = Math.max(0, Math.min(newStartIndex, files.length - FILE_VISIBLE_COUNT));

        if (newStartIndex !== fileStartIndex) {
            fileStartIndex = newStartIndex;
            fileEndIndex = fileStartIndex + FILE_VISIBLE_COUNT;

            renderFileItems(fileStartIndex);

            // THIS FUNCTION SHOULD ONLY UPDATE FILE VISUALIZATION
            const visibleFiles = files.slice(fileStartIndex, fileEndIndex);
            updateFileVisualization(visibleFiles);
        }
    }, 200);
}


function renderFileItems(startIdx) {
    if (!fileItemsContainer) {
        console.error("Error: fileItemsContainer is not defined.");
        return;
    }

    if (!files.length) {
        console.warn("No files to render!");
        return;
    }

    const endIndex = Math.min(startIdx + FILE_VISIBLE_COUNT, files.length);
    const newFileSlice = files.slice(startIdx, endIndex);

    let items = fileItemsContainer.selectAll('.file-item')
        .data(newFileSlice, d => d.name);

    items.exit().remove();

    const enterItems = items.enter()
        .append('div')
        .attr('class', 'file-item')
        .style('position', 'relative')
        .style('opacity', 0)
        .html(file => {
            // Fallback if lastUpdated is missing
            const dateStr = file.lastUpdated
                ? file.lastUpdated.toLocaleString("en", { dateStyle: "full", timeStyle: "short" })
                : "Unknown Date";

            return `
                <p>
                  On <strong>${dateStr}</strong>,
                  I made a commit to <strong>${file.name}</strong> with a total of 
                  <strong>${file.totalLines}</strong> lines. 
                  Then I looked over all I had made, and I saw that it was very good.
                </p>
            `;
        });

    enterItems.transition()
        .duration(200)
        .style('opacity', 1);

    items = enterItems.merge(items);
    items.style('top', (_, idx) => `${(startIdx + idx) * FILE_ITEM_HEIGHT}px`);
}

/*******************************************************
 * 8) MAIN ENTRY POINT
 *******************************************************/
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
    if (!commits.length || !files.length) {
        console.error("Error: No commits or files loaded. Scrolly will not function.");
        return;
    }

    initScatterplot();

    updateScatterplot(commits);
    updateFileVisualization(commits);
    displayStats(commits);

    initScrolly();
    initScrollyFiles();
});
