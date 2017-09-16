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
}

class GithubIssue extends Bug {
  get whiteboard() {
    return this._data.labels
      .filter(l => !l.match(/^priority:[0-9]$/))
      .map(l => "[" + l + "]")
      .join(" ");
  }
}

class BugzillaBug extends Bug {
  get whiteboard() {
    return this._data.whiteboard;
  }

  get isAssigned() {
    return this._data.assignee !== "nobody@mozilla.org";
  }
}

async function loadIssuesFromGithubRepo(searchParams) {
  let issue = gh.getIssues(searchParams.githubRepo.user, searchParams.githubRepo.project);
  let response = await issue.listIssues({state: searchParams.filters.open ? "open" : "closed"});

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
    };

    if (is.assignee) {
      data.assignee = is.assignee.login;
    }

    let labelNames = is.labels.map(l => l.name);
    data.labels = labelNames;

    let priorityLabel = labelNames.find(l => l.match(/^priority:[0-9]$/));
    if (priorityLabel) {
      data.priority = priorityLabel.split(":")[1];
    }

    return new GithubIssue(data);
  });

  return mapped;
}

async function loadBugsFromBugzilla(searchParams) {

}

function findBugs(searchParams) {
  if ("githubRepo" in searchParams) {
    return loadIssuesFromGithubRepo(searchParams);
  }

  // TODO: loadBugsFromBugzilla ...
  throw new Error("oops ...");
}

function filterBugs(bugs, searchParams) {
  if (!("filters" in searchParams)) {
    return bugs;
  }

  let filters = searchParams.filters;
  if ("unprioritized" in filters) {
    bugs = bugs.filter(b => b.priority === null);
  }
  if ("priority" in filters) {
    bugs = bugs.filter(b => String(b.priority) === String(filters.priority));
  }

  return bugs;
}

async function joinMultipleBugSearches(searchList) {
  let buglists = [];
  for (let search of searchList) {
    let bugs = await findBugs(search);
    let filtered = filterBugs(bugs, search);
    buglists.push(filtered);
  }

  let bugMaps = buglists.map(bl => new Map(bl.map(b => [b.id, b])));
  let uniques = new Map();
  bugMaps.forEach(bm => uniques = new Map([...uniques, ...bm]));
  let joined = [...uniques.values()];

  return joined;
}

this.findBugs = async function(searchList) {
  return joinMultipleBugSearches(searchList);
}

return this;

})();
