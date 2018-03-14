var bugz = (function() {

class Bug {
  constructor(data) {
    this._data = data;
  }

  get id() {
    return this._data.id;
  }

  get isAssigned() {
    return this._data.assignee !== null;
  }

  get assignee() {
    return this._data.assignee;
  }

  get title() {
    return this._data.title;
  }

  get labels() {
    return [];
  }

  get whiteboard() {
    return "";
  }

  get url() {
    return this._data.url;
  }

  get hasPriority() {
    return this._data.priority !== null;
  }

  get priority() {
    return this._data.priority;
  }

  get points() {
    return this._data.points;
  }

  get project() {
    return "";
  }

  get isPullRequest() {
    return false;
  }
}

class GithubIssue extends Bug {
  get whiteboard() {
    return this._data.labels
      .filter(l => !l.match(/^priority:[0-9]$/))
      .map(l => "[" + l + "]")
      .join(" ");
  }

  get project() {
    return this._data.project;
  }

  get isPullRequest() {
    return this._data.isPullRequest;
  }
}

class BugzillaBug extends Bug {
  get whiteboard() {
    return this._data.whiteboard;
  }

  get isAssigned() {
    return this._data.assignee !== "nobody@mozilla.org";
  }

  get project() {
    return this._data.component;
  }
}

async function loadIssuesFromGithubRepo(searchParams) {
  let {search, filters} = searchParams;

  let projectIssues = gh.getIssues(search.user, search.project);
  let queryParams = {
    state: (filters && filters.open) ? "open" : "closed",
  };
  let response = await projectIssues.listIssues(queryParams);

  let mapped = response.data.map(is => {
    let data = {
      id: "gh:" + is.id,
      assignee: null,
      points: null,
      title: is.title,
      lastChangeDate: is.updated_at,
      url: is.html_url,
      whiteboard: null,
      priority: null,
      labels: null,
      project: search.project,
      isPullRequest: ("pull_request" in is),
    };

    if (is.assignee) {
      data.assignee = is.assignee.login;
    }

    let labelNames = is.labels.map(l => l.name);
    data.labels = labelNames;
    if (data.isPullRequest) {
      data.labels.push("pr");
    }

    let priorityLabel = labelNames.find(l => l.match(/^priority:[0-9]$/));
    if (priorityLabel) {
      data.priority = priorityLabel.split(":")[1];
    }

    return new GithubIssue(data);
  });

  return mapped;
}

async function loadBugsFromBugzilla(searchParams) {
  let {search, filters} = searchParams;
  let queryParams = {};

  // Set up basic search type.
  switch (search.type) {
  case "bugzillaComponent":
    queryParams.quicksearch = `product:"${search.product}" component:"${search.component}"`;
    break;
  case "bugzillaAssignees":
    queryParams.quicksearch = `assigned_to:${search.assignees.join(',')}`;
    break;
  case "bugzillaMentors":
    //queryParams.quicksearch = `mentor:"${search.mentors.join(',')}"`;
    queryParams.emailtype1 = "regexp";
    queryParams.email1 = teamEmails.join("|");
    queryParams.emailbug_mentor1 = "1";
    break;
  case "bugzillaWhiteboard":
    queryParams.quicksearch = `whiteboard:"${search.whiteboardContent}"`;
    break;
  default:
    throw new Error("Oops... unsupported query type.");
  }

  // Add query-time filters.
  if (filters) {
    if ("priority" in filters) {
      queryParams.priority = "P" + filters.priority;
    }
    if ("open" in filters) {
      if (filters.open) {
        queryParams.resolution = "---";
      }
    }
    if ("isAssigned" in filters) {
      queryParams.emailtype2 = filters.isAssigned ? "notequals" : "equals";
      queryParams.email2 = "nobody@mozilla.org";
      queryParams.emailassigned_to2 = "1";
    }
  }

  let bugs = await new Promise((resolve, reject) => {
    bugzilla.searchBugs(queryParams, (error, bugs) => {
      if (error) {
        reject(error);
        return;
      }

      resolve(bugs);
    });
  });

  let mapped = bugs.map(b => {
    let data = {
      id: "bz:" + b.id,
      assignee: null,
      points: null,
      title: b.summary,
      lastChangeDate: null,
      url: "https://bugzilla.mozilla.org/show_bug.cgi?id=" + b.id,
      whiteboard: b.whiteboard,
      priority: null,
      labels: null,
      product: b.product,
      component: b.component,
    };

    if (b.assigned_to !== "nobody@mozilla.org") {
      data.assignee = b.assigned_to;
    }

    if (b.cf_fx_points !== "---") {
      data.points = parseInt(b.cf_fx_points, 10);
    }

    if (b.priority !== "--") {
      data.priority = parseInt(b.priority.substring(1), 10);
    }

    return new BugzillaBug(data);
  });

  return mapped;
}

function findBugs(searchParams) {
  let queryWords = new Map([
    ["githubRepo", loadIssuesFromGithubRepo],
    ["bugzillaComponent", loadBugsFromBugzilla],
    ["bugzillaAssignees", loadBugsFromBugzilla],
    ["bugzillaMentors", loadBugsFromBugzilla],
    ["bugzillaWhiteboard", loadBugsFromBugzilla],
  ]);

  let {search} = searchParams;
  if (!search || !(queryWords.has(search.type))) {
    throw new Error("Oops ... unsupported bug search type.");
  }

  return queryWords.get(search.type)(searchParams);
}

function filterBugs(bugs, searchParams) {
  let {filters} = searchParams;
  if (!filters) {
    return bugs;
  }

  if ("unprioritized" in filters) {
    bugs = bugs.filter(b => b.priority === null);
  }
  if ("priority" in filters) {
    bugs = bugs.filter(b => String(b.priority) === String(filters.priority));
  }
  if ("customFilter" in filters) {
    bugs = bugs.filter(b => filters.customFilter(b));
  }
  if ("assignees" in filters) {
    bugs = bugs.filter(b => filters.assignees.includes(b.assignee));
  }
  if ("isPullRequest" in filters) {
    bugs = bugs.filter(b => b.isPullRequest == filters.isPullRequest);
  }

  return bugs;
}

const bugCache = new Map();

this.findBugs = async function(searchList) {
  let buglists = [];
  for (let search of searchList) {
    // TODO: non-hackish way to cache this.
    let cacheKey = JSON.stringify(search);
    let cached = bugCache.get(cacheKey);

    if (cached === undefined) {
      let bugs = await findBugs(search);
      let filtered = filterBugs(bugs, search);
      bugCache.set(cacheKey, filtered);
    }

    buglists.push(bugCache.get(cacheKey));
  }

  let bugMaps = buglists.map(bl => new Map(bl.map(b => [b.id, b])));
  let uniques = new Map();
  bugMaps.forEach(bm => uniques = new Map([...uniques, ...bm]));
  let joined = [...uniques.values()];

  return joined;
}

return this;

})();
