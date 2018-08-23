/*
Copyright (c) 2015 Georg Fritzsche <georg.fritzsche@gmail.com>

Permission is hereby granted, free of charge, to any person obtaining
a copy of this software and associated documentation files (the
"Software"), to deal in the Software without restriction, including
without limitation the rights to use, copy, modify, merge, publish,
distribute, sublicense, and/or sell copies of the Software, and to
permit persons to whom the Software is furnished to do so, subject to
the following conditions:

The above copyright notice and this permission notice shall be
included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
*/

"use strict";

let gCategory;
const bugzilla = bz.createClient();
const gh = new GitHub();

// TODO: refactor to people list with email, name, shortname, gh alias, team list.
let teamEmails = [
  "chutten@mozilla.com",
  "gfritzsche@mozilla.com",
  "alessio.placitelli@gmail.com",
  "flyinggrub@gmail.com",
  "kustiuzhanina@mozilla.com",
  "alexrs95@gmail.com",
  "jrediger@mozilla.com",
];
let teamGithubNames = [
  "georgf",
  "chutten",
  "badboy",
  "Dexterp37",
];

const tmoGithubProjects = [
  {
    user: "mozilla",
    project: "medusa",
  },
  {
    user: "mozilla",
    project: "cerberus",
  },
  {
    user: "mozilla",
    project: "telemetry-dashboard",
  },
  {
    user: "mozilla",
    project: "probe-dictionary",
  },
  {
    user: "mozilla",
    project: "probe-scraper",
  },
];

const tmoBugzillaProjects = [
  {
    product: "Webtools",
    component: "Telemetry Dashboard",
  },
  {
    product: "Data Platform and Tools",
    component: "Datasets: Telemetry Aggregates",
  },
  {
    product: "Data Platform and Tools",
    component: "Telemetry Aggregation Service",
  },
];

const telemetryBugzillaProjects = [
  {
    product: "Toolkit",
    component: "Telemetry",
  }
];

const telemetryGithubProjects = [
  {
    user: "mozilla",
    project: "fhr-jelly",
  }
];

let bugLists = new Map([
  // TODO:
  // - query recent bugs as "recent".
  // - query recent mentored bugs as "mentees".

  /**************************************************************************
   * Currently active bugs for client team.
   *************************************************************************/
  ["active", new Map([
    ["active projects", {
      columns: ["assignee", "title", "project", "whiteboard"],
      searches: [
        {
          search: {
            type: "bugzillaWhiteboard",
            whiteboardContent: "[measurement:client:project]",
          },
          filters: {
            open: true,
            isAssigned: true,
          },
        },
      ],
    }],

    ... [1, 2].map(priority => [
      `p${priority}`,
      {
        columns: ["assignee", "points", "title", "project", "whiteboard"],
        searches: [
          ... tmoGithubProjects.map(p => ({
            search: {
              type: "githubRepo",
              user: p.user,
              project: p.project,
            },
            filters: {
              priority: priority,
              open: true,
              assignees: teamGithubNames,
            },
          })),
          ... tmoBugzillaProjects.map(p => ({
            search: {
              type: "bugzillaComponent",
              product: p.product,
              component: p.component,
            },
            filters: {
              priority: priority,
              open: true,
              assignees: teamEmails,
            },
          })),
          ... telemetryBugzillaProjects.map(p => ({
            search: {
              type: "bugzillaComponent",
              product: p.product,
              component: p.component,
            },
            filters: {
              priority: priority,
              open: true,
            },
          })),
          ... telemetryGithubProjects.map(p => ({
            search: {
              type: "githubRepo",
              user: p.user,
              project: p.project,
            },
            filters: {
              priority: priority,
              open: true,
            },
          })),
          {
            search: {
              type: "bugzillaAssignees",
              assignees: teamEmails,
            },
            filters: {
              priority: priority,
              open: true,
            },
          },
          {
            search: {
              type: "bugzillaWhiteboard",
              whiteboardContent: "[measurement:client]",
            },
            filters: {
              open: true,
              priority: priority,
            },
          },
        ],
      },
    ]),
    ["mentored wip", {
      columns: ["assignee", "title", "project", "whiteboard", "mentors"],
      searches: [
        {
          search: {
            type: "bugzillaMentors",
            mentors: teamEmails,
          },
          filters: {
            open: true,
            isAssigned: true,
          },
        },
      ],
    }],
    ["tracking", {
      columns: ["assignee", "title", "project", "whiteboard"],
      searches: [
        {
          search: {
            type: "bugzillaWhiteboard",
            whiteboardContent: "[measurement:client:tracking]",
          },
          filters: {
            open: true,
          },
        },
        ... telemetryBugzillaProjects.map(p => ({
          search: {
            type: "bugzillaComponent",
            product: p.product,
            component: p.component,
          },
          filters: {
            open: true,
            whiteboard: "[qf",
            customFilter: bug => !bug.whiteboard.includes("[qf-]"),
          },
        })),
      ],
    }],
  ])],

  /**************************************************************************
   * p3, p4, p5 categories for client team.
   *************************************************************************/
  ... [3, 4, 5].map(priority => ["p" + priority, new Map([
    ["p" + priority, {
      columns: ["assignee", "title", "whiteboard"],
      searches: telemetryBugzillaProjects.map(p => ({
        search: {
          type: "bugzillaComponent",
          product: p.product,
          component: p.component,
        },
        filters: {
          priority: priority,
          open: true,
        },
      })),
    }],
  ])]),

  ["projects", new Map([
    ["projects", {
      columns: ["assignee", "title", "project", "whiteboard"],
      searches: [
        {
          search: {
            type: "bugzillaWhiteboard",
            whiteboardContent: "[measurement:client:project]",
          },
          filters: {
            open: true,
          },
        },
      ],
    }],
  ])],

  /**************************************************************************
   * Mentored bugs for client team.
   *************************************************************************/
  ["mentored", new Map([
    ["mentored wip", {
      columns: ["assignee", "title", "whiteboard", "mentors"],
      searches: [
        {
          search: {
            type: "bugzillaMentors",
            mentors: teamEmails,
          },
          filters: {
            open: true,
            isAssigned: true,
          },
        },
      ],
    }],
    ["mentored free", {
      columns: ["title", "whiteboard", "mentors"],
      searches: [
        {
          search: {
            type: "bugzillaMentors",
            mentors: teamEmails,
          },
          filters: {
            open: true,
            isAssigned: false,
          },
        },
      ],
    }],
  ])],

  /**************************************************************************
   * Untriaged bugs for client team.
   *************************************************************************/
  ["untriaged", new Map([
    ["untriaged, telemetry",
      {
        columns: ["assignee", "title", "project", "whiteboard"],
        searches: [
          ... telemetryBugzillaProjects.map(p => ({
            search: {
              type: "bugzillaComponent",
              product: p.product,
              component: p.component,
            },
            filters: {
              unprioritized: true,
              open: true,
            },
          })),
          {
            search: {
              type: "bugzillaAssignees",
              assignees: teamEmails,
            },
            filters: {
              unprioritized: true,
              open: true,
            },
          }
        ],
      }
    ],
  ])],

  /**************************************************************************
   * Triaged bugs for TMO team.
   *************************************************************************/
  ["tmo_triaged", new Map([
    [
      "tmo prs",
      {
        columns: ["assignee", "title", "project", "whiteboard"],
        searches: [
          ... tmoGithubProjects.map(p => ({
            search: {
              type: "githubRepo",
              user: p.user,
              project: p.project,
            },
            filters: {
              open: true,
              isPullRequest: true,
            },
          })),
        ],
      },
    ],
    ... ["1", "2", "3", "4"].map(priority => [
      "tmo p" + priority,
      {
        columns: ["assignee", "title", "project", "whiteboard"],
        searches: [
          ... tmoGithubProjects.map(p => ({
            search: {
              type: "githubRepo",
              user: p.user,
              project: p.project,
            },
            filters: {
              priority: priority,
              open: true,
              isPullRequest: false,
            },
          })),
          ... tmoBugzillaProjects.map(p => ({
            search: {
              type: "bugzillaComponent",
              product: p.product,
              component: p.component,
            },
            filters: {
              priority: priority,
              open: true,
            },
          })),
        ],
      },
    ]),
  ])],

  /**************************************************************************
   * Untriaged bugs for TMO team.
   *************************************************************************/
  ["tmo_untriaged", new Map([
    ["tmo untriaged", {
      columns: ["assignee", "title", "project", "whiteboard"],
      searches: [
        ... tmoGithubProjects.map(p => ({
          search: {
            type: "githubRepo",
            user: p.user,
            project: p.project,
          },
          filters: {
            unprioritized: true,
            open: true,
            isPullRequest: false,
          },
        })),
        ... tmoBugzillaProjects.map(p => ({
          search: {
            type: "bugzillaComponent",
            product: p.product,
            component: p.component,
          },
          filters: {
            unprioritized: true,
            open: true,
          },
        })),
      ],
    }]
  ])],

  /**************************************************************************
   * Triaged bugs for Data Platform team.
   *************************************************************************/
  ["dataplatform_triaged", new Map([1, 2].map(priority => [
    `p${priority}`,
    {
      columns: ["assignee", "title", "project", "whiteboard"],
      searches: [
        {
          search: {
            type: "bugzillaWhiteboard",
            whiteboardContent: "[DataPlatform]",
          },
          filters: {
            priority: priority,
            open: true,
          },
        },
      ],
    }
  ]))],

  /**************************************************************************
   * Untriaged bugs for Data Platform team.
   *************************************************************************/
  ["dataplatform_untriaged", new Map([
    ["dataplatform untriaged", {
      columns: ["assignee", "title", "project", "whiteboard"],
      searches: [
        {
          search: {
            type: "bugzillaWhiteboard",
            whiteboardContent: "[DataPlatform]",
          },
          filters: {
            unprioritized: true,
            open: true,
          },
        },
      ],
    }]
  ])],

  /**************************************************************************
   * Backlog bugs for Data Platform team.
   *************************************************************************/
  ["dataplatform_backlog", new Map([3, 4, 5].map(priority => [
    `p${priority}`,
    {
      columns: ["assignee", "title", "project", "whiteboard"],
      searches: [
        {
          search: {
            type: "bugzillaWhiteboard",
            whiteboardContent: "[DataPlatform]",
          },
          filters: {
            priority: priority,
            open: true,
          },
        },
      ],
    }
  ]))],
]);

var MS_IN_A_DAY = 24 * 60 * 60 * 1000;

function futureDate(date, offset) {
  return new Date(date.getTime() + offset);
}

function alias(email) {
  let shortNames = new Map([
    ["alessio.placitelli@gmail.com", "alessio"],
    ["yarik.sheptykin@googlemail.com", "iaroslav"],
    ["robertthyberg@gmail.com", "robert thyberg"],
    ["areinald.bug@bolet.no-ip.com", "areinald"],
    ["penhlenh@gmail.com", "penh lenh"],
    ["pineapple.rice@gmail.com", "eric hu"],
    ["flyinggrub@gmail.com", "flyingrub"],
    ["kustiuzhanina@mozilla.com", "kate"],
    ["alexrs95@gmail.com", "alejandro"],
    ["jrediger@mozilla.com", "jan-erik"],
    ["nobody@mozilla.org", "-"],
    [null, ""],
  ]);

  if (shortNames.has(email)) {
    return shortNames.get(email);
  }

  let mozSuffix = "@mozilla.com";
  if (email.endsWith(mozSuffix)) {
    return email.replace(mozSuffix, "");
  }

  return email;
}

function getWhiteboardHtml(value) {
  let strip = [
    "[measurement:client]",
    "[measurement:client:tracking]",
    "[measurement:client:uplift]",
  ];
  strip.forEach(s => value = value.replace(s, ""));
  value = value.trim();

  let reTag = /\[[^\]]+\]/gi;
  let tags = [];
  let m;
  while (m = reTag.exec(value)) {
    tags.push(m[0].replace(/[\[\]]/g, ""));
  }

  let elems = tags.map(tag => {
    let span = document.createElement("span");
    span.classList.add("tag");
    span.appendChild(document.createTextNode(tag));
    return span;
  });

  elems.push(document.createTextNode(value.replace(reTag, "")));

  return elems;
}

function getAssigneeHtml(bug, value) {
  if (!bug.isAssigned && bug.whiteboard.includes("[assigned]")) {
    let italic = document.createElement("i");
    italic.appendChild(document.createTextNode("assigned"));
    return [italic];
  }
  return alias(value);
}

function getBugField(bug, field, index=0) {
  let value = bug[field];
  switch (field) {
    case "assignee":
      return getAssigneeHtml(bug, value);
    case "whiteboard":
      return getWhiteboardHtml(value);
    case "title":
      return (value.length <= 100) ? value : (value.substring(0, 100) +  " ...");
    case "points":
      return (value !== null) ? value : "";
    case "priority":
      return (value !== null) ? value : "-";
    case "index":
      return index;
    case "mentors":
      return value.map(alias).join(", ");
    default:
      return value;
  }
}

function niceFieldName(fieldName) {
  let niceNames = new Map([
    //["assigned_to", "assignee"],
    //["cf_fx_points", "points"],
  ]);

  return niceNames.get(fieldName) || fieldName;
}

function removeAllChildNodes(node) {
  while(node.hasChildNodes()) {
    node.removeChild(node.lastChild);
  }
}

function createLink(text, url) {
  let link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("target", "_blank");
  link.appendChild(document.createTextNode(text));
  return link;
}

function createTableHeaders(titles) {
  let row = document.createElement("tr");
  for (let title of titles) {
    let cell = document.createElement("th");
    cell.appendChild(document.createTextNode(niceFieldName(title)));
    row.appendChild(cell);
  }
  return row;
}

function createTableRow(contents) {
  let row = document.createElement("tr");

  for (let content of contents) {
    let cell = document.createElement("td");
    if (typeof(content) === "function") {
      content(cell);
    } else if (Array.isArray(content)) {
      for (let e of content) {
        cell.appendChild(e);
      }
    } else {
      cell.appendChild(document.createTextNode(content));
    }
    row.appendChild(cell);
  }

  return row;
}

function compareBugsByAssignee(a, b) {
  a = a.assignee;
  b = b.assignee;

  if (a == b)
    return 0;
  if (a == null)
    return 1;
  if (b == null)
    return -1;

  return a.localeCompare(b);
}

function getSorter(listOptions) {
  switch (listOptions.sortColumn) {
    case "last_change_time":
      return (a, b) => - a.last_change_time.localeCompare(b.last_change_time);
    default:
      return compareBugsByAssignee;
  }
}

function addBugList(listName, listOptions, bugs) {
  console.log("addBugList - " + listName);

  bugs.sort(getSorter(listOptions));

  let content = document.getElementById("content");
  let section = document.createElement("div");
  section.className = "buglist";

  let table = document.createElement("table");
  section.appendChild(table);

  let caption = document.createElement("caption");
  caption.appendChild(document.createTextNode(listName));
  caption.setAttribute("title", "" + bugs.length + " bugs");
  table.appendChild(caption);

  let bugFields = listOptions.columns || ["assignee", "status", "summary"];
  table.appendChild(createTableHeaders([
    "#",
    ...bugFields.map(f => niceFieldName(f)),
  ]));

  for (let i = 0; i < bugs.length; ++i) {
    let bug = bugs[i];
    let url = bug.url;
    table.appendChild(createTableRow([
      (cell) => cell.appendChild(createLink(String(i + 1), url)),
      ...bugFields.map(f => getBugField(bug, f, i + 1)),
    ]));
  }

  content.appendChild(section);
}

function update() {
  console.log("updating...");
  document.getElementById("overlay").style.display = "block";
  removeAllChildNodes(document.getElementById("content"));

  let shownLists = [...bugLists.get(gCategory)];
  let searchPromises = shownLists.map(bl => {
    return bugz.findBugs(bl[1].searches);
  });

  Promise.all(searchPromises).then(results => {
    for (let i = 0; i < results.length; ++i) {
      let bugs = results[i];
      let [listName, listOptions] = shownLists[i];

      addBugList(listName, listOptions, bugs);
    }

    document.getElementById("overlay").style.display = "none";
  });
}

function createCategories() {
  let categories = new Set([...bugLists.keys()]);
  let container = document.getElementById("categories");
  let form = document.createElement("form");

  let hash = window.location.hash.substring(1);
  gCategory = categories.has(hash) ? hash : categories.values().next().value;

  for (let title of categories) {
    let radio = document.createElement("input");
    radio.name = "category";
    radio.value = title;
    radio.type = "radio";
    radio.checked = (title === gCategory);
    radio.addEventListener("change", (evt) => {
      gCategory = evt.target.value;
      window.location = "#" + gCategory;
      for (let el of document.getElementsByClassName("nav-category")) {
        if (el.id == ("nav-category-" + gCategory)) {
          el.classList.add("active");
        } else {
          el.classList.remove("active");
        }
      }
      update();
    }, false);

    let label = document.createElement("label");
    label.appendChild(radio);
    label.appendChild(document.createTextNode(title));
    label.classList.add("nav-category");
    if (title == gCategory) {
      label.classList.add("active");
    }
    label.id = "nav-category-" + title;

    form.appendChild(label);
  }

  container.appendChild(form);
}

function init() {
  createCategories();
  update();
}

init();
