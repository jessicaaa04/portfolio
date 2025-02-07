import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from "https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm";

let selectedIndex = -1; // No wedge selected initially
let selectedYear = null; // Stores selected year

async function loadProjects() {
    try {
        const projects = await fetchJSON('../lib/projects.json');
        const projectsContainer = document.querySelector('.projects');
        const projectsTitle = document.querySelector('.projects-title');

        if (projectsTitle) {
            projectsTitle.textContent = `${projects.length} Projects`;
        }

        if (!projectsContainer) {
            console.error("Projects container not found.");
            return;
        }

        renderProjects(projects, projectsContainer, 'h2');
        renderPieChart(projects);

        setupSearch(projects, projectsContainer);

    } catch (error) {
        console.error("Error loading projects:", error);
    }
}

function renderPieChart(projectsGiven) {
    let newRolledData = d3.rollups(
        projectsGiven,
        (v) => v.length,
        (d) => d.year
    );

    let newData = newRolledData.map(([year, count]) => ({
        value: count,
        label: year
    }));

    let sliceGenerator = d3.pie().value((d) => d.value);
    let arcData = sliceGenerator(newData);
    let arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    let colors = d3.scaleOrdinal(d3.schemeTableau10);

    let svg = d3.select("#projects-pie-plot");
    svg.selectAll("*").remove(); // Clear previous SVG elements

    let legend = d3.select(".legend");
    legend.selectAll("*").remove(); // Clear previous legend

    // Draw Pie Slices
    let paths = svg.selectAll("path")
        .data(arcData)
        .enter()
        .append("path")
        .attr("d", arcGenerator)
        .attr("fill", (_, i) => colors(i))
        .attr("class", (_, i) => i === selectedIndex ? "selected wedge" : "wedge")
        .on("click", function (event, d) {
            let clickedIndex = arcData.indexOf(d);
            selectedIndex = selectedIndex === clickedIndex ? -1 : clickedIndex;
            selectedYear = selectedIndex === -1 ? null : newData[selectedIndex].label;

            console.log(`Clicked Wedge: Index ${selectedIndex}, Year: ${selectedYear}`);

            updateProjectsDisplay(projectsGiven);
            renderPieChart(projectsGiven); // Re-render pie chart to reflect selection
        });

    // Generate Legend
    newData.forEach((d, idx) => {
        let legendItem = legend.append("li")
            .attr("style", `--color:${colors(idx)}`)
            .attr("class", idx === selectedIndex ? "selected legend-item" : "legend-item")
            .html(`<span class="swatch"></span> ${d.label} <em>(${d.value})</em>`)
            .on("click", function () {
                selectedIndex = selectedIndex === idx ? -1 : idx;
                selectedYear = selectedIndex === -1 ? null : newData[selectedIndex].label;

                console.log(`Selected Year via Legend: ${selectedYear}`);

                updateProjectsDisplay(projectsGiven);
                renderPieChart(projectsGiven);
            });

        legendItem.style("cursor", "pointer"); // Make legend items clickable
    });
}

// Function to update displayed projects based on selected wedge
function updateProjectsDisplay(projects) {
    let filteredProjects = selectedYear ? projects.filter(p => p.year === selectedYear) : projects;
    renderProjects(filteredProjects, document.querySelector('.projects'), 'h2');
}

function setupSearch(projects, projectsContainer) {
    let query = "";
    let searchInput = document.querySelector('.searchBar');

    searchInput.addEventListener('input', (event) => {
        query = event.target.value.toLowerCase();

        let filteredProjects = projects.filter((project) => {
            let values = Object.values(project).join('\n').toLowerCase();
            return values.includes(query);
        });

        renderProjects(filteredProjects, projectsContainer, 'h2');
        renderPieChart(filteredProjects);
    });
}

loadProjects();



