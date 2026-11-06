-- Projects table
CREATE TABLE projects (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    path TEXT NOT NULL UNIQUE,
    git_remote_url TEXT,
    git_branch TEXT,
    git_commit TEXT,
    git_dirty BOOLEAN NOT NULL DEFAULT 0,
    dev_environment_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX idx_projects_path ON projects(path);
CREATE INDEX idx_projects_dev_environment_id ON projects(dev_environment_id);

-- Project environments table
CREATE TABLE project_environments (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL,
    config_type TEXT NOT NULL, -- "devcontainer" | "compose" | "auto"
    config_json TEXT NOT NULL,
    runtime TEXT NOT NULL DEFAULT 'lima-docker',
    state TEXT NOT NULL DEFAULT 'stopped', -- "stopped" | "starting" | "running" | "error"
    container_id TEXT,
    ports_json TEXT NOT NULL DEFAULT '[]',
    mounts_json TEXT NOT NULL DEFAULT '[]',
    env_vars_json TEXT NOT NULL DEFAULT '[]',
    error TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

CREATE INDEX idx_project_environments_project_id ON project_environments(project_id);
CREATE INDEX idx_project_environments_state ON project_environments(state);
CREATE INDEX idx_project_environments_container_id ON project_environments(container_id);