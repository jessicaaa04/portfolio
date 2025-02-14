let data = [];
let commits = [];
let brushSelection = null; 
let xScale, yScale;

async function loadData() {
    try {
        data = await d3.csv('../meta/loc.csv', (row) => ({
            ...row,
            line: Number(row.line),
            depth: Number(row.depth),
            length: Number(row.length),
            date: new Date(row.date + 'T00:00' + row.timezone),
            datetime: new Date(row.datetime),
        }));

        if (data.length > 0) {
            processCommits();
            displayStats();
            createScatterplot();
        } else {
            console.warn("No data loaded from loc.csv.");
        }
    } catch (error) {
        console.error("Error loading data:", error);
    }
}

// Function to process commit data
function processCommits() {
    if (!data.length) {
        console.warn("No data available to process commits.");
        return;
    }

    commits = d3.groups(data, (d) => d.commit)
        .map(([commit, lines]) => {
            let first = lines[0];
            let { author, date, time, timezone, datetime } = first;

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
                lines: lines.map(d => ({ type: d.type, length: d.length })),
            };
        });
}

// Function to update tooltip content
function updateTooltipContent(commit) {
    console.log("Commit Data Received:", commit);  // Debugging line

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


// Function to show/hide tooltip
function updateTooltipVisibility(isVisible) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.hidden = !isVisible;
}

// Function to update tooltip position near the cursor
function updateTooltipPosition(event) {
    const tooltip = document.getElementById('commit-tooltip');
    tooltip.style.left = `${event.clientX + 10}px`;
    tooltip.style.top = `${event.clientY + 10}px`;
}

// Function to display statistics
function displayStats() {
    if (!data.length || !commits.length) {
        console.warn("No data available for displaying stats.");
        return;
    }

    d3.select('#stats').html("").append('div').attr('class', 'stats-container');
    const dl = d3.select('.stats-container');

    dl.append('dl').html('<dt>Total Commits</dt><dd>' + commits.length + '</dd>');
    const numFiles = d3.group(data, (d) => d.file).size;
    dl.append('dl').html('<dt>Total Files</dt><dd>' + numFiles + '</dd>');

    const workByPeriod = d3.rollups(
        data,
        (v) => v.length,
        (d) => new Date(d.datetime).toLocaleString('en', { hour: 'numeric', hour12: true })
    );
    const mostActiveTime = d3.greatest(workByPeriod, (d) => d[1])?.[0] || "Unknown";
    dl.append('dl').html('<dt>Most Active Time of Day</dt><dd>' + mostActiveTime + '</dd>');

    const workByDay = d3.rollups(
        data,
        (v) => v.length,
        (d) => new Date(d.datetime).toLocaleString('en', { weekday: 'long' })
    );
    const mostActiveDay = d3.greatest(workByDay, (d) => d[1])?.[0] || "Unknown";
    dl.append('dl').html('<dt>Most Active Day of the Week</dt><dd>' + mostActiveDay + '</dd>');
}

// Scatterplot Configuration
const width = 1000, height = 600, margin = { top: 50, right: 30, bottom: 70, left: 70 };

// Define color scale based on the hour of the day (0 = midnight, 12 = noon, 24 = midnight)
const colorScale = d3.scaleSequential()
    .domain([0, 24]) // Full range of hours in a day
    .interpolator(d3.interpolateRgbBasis(["#4b74ff", "#ffba42"])); // Night blue → Day orange

function createScatterplot() {
    if (!commits.length) {
        console.warn("No commit data available for scatterplot.");
        return;
    }

    const usableArea = {
        top: margin.top,
        right: width - margin.right,
        bottom: height - margin.bottom,
        left: margin.left,
        width: width - margin.left - margin.right,
        height: height - margin.top - margin.bottom,
    };

    const svg = d3.select('#chart')
        .append('svg')
        .attr('width', width)
        .attr('height', height)
        .append('g')
        .attr('transform', `translate(${margin.left}, ${margin.top})`);
    
    svg.append("text")
        .attr("x", usableArea.width / 2)
        .attr("y", -10)
        .attr("text-anchor", "middle")
        .style("font-size", "20px")
        .style("font-weight", "bold")
        .text("Commits by Time of Day");

    // Define scales
   xScale = d3.scaleTime()
        .domain(d3.extent(commits, (d) => d.datetime))
        .range([0, usableArea.width])
        .nice();

    yScale = d3.scaleLinear()
        .domain([0, 24])
        .range([usableArea.height, 0]);

    // Fixing Area Perception with Square Root Scaling
    const [minLines, maxLines] = d3.extent(commits, (d) => d.totalLines);
    const rScale = d3.scaleSqrt().domain([minLines, maxLines]).range([2, 14]);

    // Sorting Commits by Size to Improve Interaction
    const sortedCommits = d3.sort(commits, (d) => -d.totalLines); // Largest dots rendered first

    // Add horizontal gridlines BEFORE axes
    const gridlines = svg.append("g")
        .attr("class", "gridlines")
        .call(
            d3.axisLeft(yScale)
                .tickFormat("") // Remove tick labels
                .tickSize(-usableArea.width) // Extend ticks across the chart width
        );

    // Create axes
    const xAxis = d3.axisBottom(xScale)
        .tickFormat(d3.timeFormat("%b %d"))
        .ticks(10);

    const yAxis = d3.axisLeft(yScale)
        .tickFormat((d) => String(d % 24).padStart(2, '0') + ':00');

    svg.append('g')
        .attr('transform', `translate(0, ${usableArea.height})`)
        .call(xAxis)
        .selectAll("text")
        .style("text-anchor", "end")
        .attr("transform", "rotate(-30)")
        .style("font-size", "12px");

    svg.append('g').call(yAxis);

    // Add circles (dots) with dynamic colors based on time of day
    svg.append('g')
        .attr("class", "dots")
        .selectAll('circle')
        .data(sortedCommits)
        .join('circle')
        .attr('cx', (d) => xScale(d.datetime))
        .attr('cy', (d) => yScale(d.hourFrac))
        .attr('r', (d) => rScale(d.totalLines))
        .style("fill-opacity", 0.7)
        .attr('fill', (d) => colorScale(d.hourFrac)) // Set color dynamically
        .on('mouseenter', (event, commit) => {
            updateTooltipContent(commit);
            updateTooltipVisibility(true);
            updateTooltipPosition(event);
            d3.select(event.currentTarget).style("fill-opacity", 1);
        })
        .on('mousemove', (event) => updateTooltipPosition(event))
        .on('mouseleave', (event) => {
            updateTooltipVisibility(false); // Just hide tooltip, don't call `updateTooltipContent({})`
            d3.select(event.currentTarget).style("fill-opacity", 0.7);
        });
        
    
    brushSelector(svg);
}

function brushSelector(svg) {
    const brush = d3.brush()
        .extent([[0, 0], [width, height]])
        .on("start brush end", brushed); 

    svg.append("g")
        .attr("class", "brush")
        .call(brush);

    svg.selectAll(".dots").raise();
}

function isCommitSelected(commit) {
    if (!brushSelection) return false;

    const [[x0, y0], [x1, y1]] = brushSelection;

    // Convert brush selection (pixel space) to data space
    const xMin = xScale.invert(x0);
    const xMax = xScale.invert(x1);
    const yMin = yScale.invert(y1); // Inverted since SVG y-coordinates go downward
    const yMax = yScale.invert(y0);

    // Convert commit's datetime and hourFrac into pixel space
    const commitX = xScale(commit.datetime);
    const commitY = yScale(commit.hourFrac);

    const isSelected = commitX >= x0 && commitX <= x1 && commitY >= y0 && commitY <= y1;

    return isSelected;
}

function updateSelectionCount() {
    const selectedCommits = brushSelection
        ? commits.filter(isCommitSelected)
        : [];

    const countElement = document.getElementById("selection-count");

    countElement.textContent = `${
        selectedCommits.length || "No"
    } commits selected`;

    return selectedCommits;
}


function updateSelection() {
    const selectedCommits = commits.filter(isCommitSelected); // Get all selected commits

    d3.selectAll("circle")
        .classed("selected", (d) => isCommitSelected(d))
        .attr("fill", (d) => isCommitSelected(d) ? "#ff6b6b" : colorScale(d.hourFrac));  // Change color to red if selected

    if (selectedCommits.length > 0) {
        // Pick the first commit to show in the tooltip
        updateTooltipContent(selectedCommits[0]);
        updateTooltipVisibility(true);

        // Position tooltip at the center of the selection box
        const [[x0, y0], [x1, y1]] = brushSelection;
        const centerX = (x0 + x1) / 2;
        const centerY = (y0 + y1) / 2;

        updateTooltipPosition({ clientX: centerX, clientY: centerY });
    } else {
        updateTooltipVisibility(false);
    }
}

function updateLanguageBreakdown() {
    const selectedCommits = brushSelection
        ? commits.filter(isCommitSelected)
        : [];

    const container = document.getElementById('language-breakdown');

    if (selectedCommits.length === 0) {
        container.innerHTML = '<p>No language breakdown available</p>';
        return;
    }

    const requiredCommits = selectedCommits.length ? selectedCommits : commits;
    const lines = requiredCommits.flatMap((d) => d.lines || []);

    if (!lines.length) {
        container.innerHTML = '<p>No language data available</p>';
        return;
    }

    // Use d3.rollup to count lines per language
    const breakdown = d3.rollup(
        lines,
        (v) => v.length,
        (d) => d.type || "Unknown"
    );

    // Update DOM with row structure
    container.innerHTML = `<h3>Language Breakdown</h3>
                       <div class="language-row"></div>`; // <== Fix: Use a dedicated div for flex

    const rowContainer = container.querySelector(".language-row"); // Get the row div

    for (const [language, count] of breakdown) {
        const proportion = count / lines.length;
        const formatted = d3.format('.1%')(proportion);
        
        rowContainer.innerHTML += `
            <div class="language-item">
                <strong>${language}:</strong> ${count} lines (${formatted})
            </div>
        `;
    }

    container.innerHTML += '</div>'; // Close the row container

    return breakdown;
}


function brushed(event) {
    brushSelection = event.selection; // Store brush selection
    updateSelection(); 
    updateSelectionCount();
    updateLanguageBreakdown();
}

// Ensure script runs after DOM loads
document.addEventListener('DOMContentLoaded', async () => {
    await loadData();
});
