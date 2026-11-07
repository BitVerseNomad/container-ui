// Projects data layer with SQLite persistence

use serde::{Deserialize, Serialize};
use sqlx::{SqlitePool, sqlite::SqliteConnectOptions, migrate::MigrateDatabase, Row};
use std::path::PathBuf;
use std::process::Command;
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use chrono::{DateTime, Utc};

const DB_NAME: &str = "colima_ui.db";

// Project and Environment types
#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Project {
    pub id: String,
    pub name: String,
    pub path: String,
    pub git_remote_url: Option<String>,
    pub git_branch: Option<String>,
    pub git_commit: Option<String>,
    pub git_dirty: bool,
    pub dev_environment_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Debug)]
pub struct CreateProjectInput {
    pub path: String,
    pub name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProjectEnvironment {
    pub id: String,
    pub project_id: String,
    pub config_type: String, // "devcontainer" | "compose" | "auto"
    pub config_json: String,
    pub runtime: String,
    pub state: String, // "stopped" | "starting" | "running" | "error"
    pub container_id: Option<String>,
    pub ports_json: String,
    pub mounts_json: String,
    pub env_vars_json: String,
    pub error: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Debug)]
pub struct CreateEnvironmentInput {
    pub project_id: String,
    pub config_type: String,
    pub config_json: String,
    pub runtime: Option<String>,
}

// Database initialization
pub async fn init_db(app: &AppHandle) -> Result<SqlitePool, anyhow::Error> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get config dir: {}", e))?;
    std::fs::create_dir_all(&config_dir)?;
    let db_path = config_dir.join(DB_NAME);
    let db_url = format!("sqlite://{}?mode=rwc", db_path.display());

    // Create database if not exists
    if !sqlx::Sqlite::database_exists(&db_url).await? {
        sqlx::Sqlite::create_database(&db_url).await?;
    }

    let pool = SqlitePool::connect(&db_url).await?;

    // Run migrations
    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

// Get database path
pub fn get_db_path(app: &AppHandle) -> Result<PathBuf, anyhow::Error> {
    let config_dir = app
        .path()
        .app_config_dir()
        .map_err(|e| anyhow::anyhow!("Failed to get config dir: {}", e))?;
    std::fs::create_dir_all(&config_dir)?;
    Ok(config_dir.join(DB_NAME))
}

// Project CRUD operations
pub async fn project_create(pool: &SqlitePool, input: CreateProjectInput) -> Result<Project, String> {
    // Validate path exists and is a directory
    let path = std::path::Path::new(&input.path);
    if !path.exists() {
        return Err(format!("Path does not exist: {}", input.path));
    }
    if !path.is_dir() {
        return Err(format!("Path is not a directory: {}", input.path));
    }

    // Check if already exists
    let existing = sqlx::query("SELECT id FROM projects WHERE path = ?")
        .bind(&input.path)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;
    
    if existing.is_some() {
        return Err(format!("Project already exists at path: {}", input.path));
    }

    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let name = input.name.unwrap_or_else(|| {
        path.file_name()
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string()
    });

    sqlx::query(
        r#"
        INSERT INTO projects (id, name, path, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&name)
    .bind(&input.path)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    // Return the created project
    project_get(pool, &id).await?.ok_or_else(|| "Failed to retrieve created project".to_string())
}

pub async fn project_get(pool: &SqlitePool, id: &str) -> Result<Option<Project>, String> {
    let row = sqlx::query("SELECT * FROM projects WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(|r| row_to_project(&r)))
}

pub async fn project_list(pool: &SqlitePool) -> Result<Vec<Project>, String> {
    let rows = sqlx::query("SELECT * FROM projects ORDER BY updated_at DESC")
        .fetch_all(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| row_to_project(&r)).collect())
}

pub async fn project_delete(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM projects WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn project_set_environment(pool: &SqlitePool, project_id: &str, environment_id: Option<String>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE projects SET dev_environment_id = ?, updated_at = ? WHERE id = ?"
    )
    .bind(environment_id)
    .bind(&now)
    .bind(project_id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

// Environment CRUD operations
pub async fn environment_create(pool: &SqlitePool, input: CreateEnvironmentInput) -> Result<ProjectEnvironment, String> {
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    let runtime = input.runtime.unwrap_or_else(|| "lima-docker".to_string());

    sqlx::query(
        r#"
        INSERT INTO project_environments (id, project_id, config_type, config_json, runtime, state, ports_json, mounts_json, env_vars_json, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'stopped', '[]', '[]', '[]', ?, ?)
        "#,
    )
    .bind(&id)
    .bind(&input.project_id)
    .bind(&input.config_type)
    .bind(&input.config_json)
    .bind(&runtime)
    .bind(&now)
    .bind(&now)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;

    environment_get(pool, &id).await?.ok_or_else(|| "Failed to retrieve created environment".to_string())
}

pub async fn environment_get(pool: &SqlitePool, id: &str) -> Result<Option<ProjectEnvironment>, String> {
    let row = sqlx::query("SELECT * FROM project_environments WHERE id = ?")
        .bind(id)
        .fetch_optional(pool)
        .await
        .map_err(|e| e.to_string())?;

    Ok(row.map(|r| row_to_environment(&r)))
}

pub async fn environment_list(pool: &SqlitePool, project_id: Option<&str>) -> Result<Vec<ProjectEnvironment>, String> {
    let rows = match project_id {
        Some(pid) => {
            sqlx::query("SELECT * FROM project_environments WHERE project_id = ? ORDER BY created_at DESC")
                .bind(pid)
                .fetch_all(pool)
                .await
        }
        None => {
            sqlx::query("SELECT * FROM project_environments ORDER BY created_at DESC")
                .fetch_all(pool)
                .await
        }
    }.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| row_to_environment(&r)).collect())
}

pub async fn environment_update_state(pool: &SqlitePool, id: &str, state: &str, error: Option<String>) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE project_environments SET state = ?, error = ?, updated_at = ? WHERE id = ?"
    )
    .bind(state)
    .bind(error)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn environment_update_container_id(pool: &SqlitePool, id: &str, container_id: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE project_environments SET container_id = ?, updated_at = ? WHERE id = ?"
    )
    .bind(container_id)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn environment_update_ports(pool: &SqlitePool, id: &str, ports_json: &str) -> Result<(), String> {
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        "UPDATE project_environments SET ports_json = ?, updated_at = ? WHERE id = ?"
    )
    .bind(ports_json)
    .bind(&now)
    .bind(id)
    .execute(pool)
    .await
    .map_err(|e| e.to_string())?;
    Ok(())
}

pub async fn environment_delete(pool: &SqlitePool, id: &str) -> Result<(), String> {
    sqlx::query("DELETE FROM project_environments WHERE id = ?")
        .bind(id)
        .execute(pool)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

// Row mapping helpers
fn row_to_project(row: &sqlx::sqlite::SqliteRow) -> Project {
    Project {
        id: row.get("id"),
        name: row.get("name"),
        path: row.get("path"),
        git_remote_url: row.get("git_remote_url"),
        git_branch: row.get("git_branch"),
        git_commit: row.get("git_commit"),
        git_dirty: row.get("git_dirty"),
        dev_environment_id: row.get("dev_environment_id"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

fn row_to_environment(row: &sqlx::sqlite::SqliteRow) -> ProjectEnvironment {
    ProjectEnvironment {
        id: row.get("id"),
        project_id: row.get("project_id"),
        config_type: row.get("config_type"),
        config_json: row.get("config_json"),
        runtime: row.get("runtime"),
        state: row.get("state"),
        container_id: row.get("container_id"),
        ports_json: row.get("ports_json"),
        mounts_json: row.get("mounts_json"),
        env_vars_json: row.get("env_vars_json"),
        error: row.get("error"),
        created_at: row.get("created_at"),
        updated_at: row.get("updated_at"),
    }
}

// Tauri command wrappers
#[tauri::command]
pub async fn project_create_cmd(app: tauri::AppHandle, input: CreateProjectInput) -> Result<Project, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    project_create(&pool, input).await
}

#[tauri::command]
pub async fn project_get_cmd(app: tauri::AppHandle, id: String) -> Result<Option<Project>, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    project_get(&pool, &id).await
}

#[tauri::command]
pub async fn project_list_cmd(app: tauri::AppHandle) -> Result<Vec<Project>, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    project_list(&pool).await
}

#[tauri::command]
pub async fn project_delete_cmd(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    project_delete(&pool, &id).await
}

#[tauri::command]
pub async fn project_set_environment_cmd(app: tauri::AppHandle, project_id: String, environment_id: Option<String>) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    project_set_environment(&pool, &project_id, environment_id).await
}

#[tauri::command]
pub async fn project_refresh_git_info_cmd(app: tauri::AppHandle, project_id: String) -> Result<GitInfo, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    
    // Get the project to find its path
    let project = project_get(&pool, &project_id).await?.ok_or("Project not found")?;
    let project_path = project.path;
    
    // Run git commands in the project directory
    let remote_url = get_git_remote_url(&project_path).await.ok();
    let current_branch = get_git_current_branch(&project_path).await.ok();
    let commit_hash = get_git_commit_hash(&project_path).await.ok();
    let has_uncommitted_changes = get_git_has_uncommitted_changes(&project_path).await.unwrap_or(false);
    
    let git_info = GitInfo {
        remote_url,
        current_branch,
        commit_hash,
        has_uncommitted_changes,
    };
    
    // Update the project in the database
    let now = Utc::now().to_rfc3339();
    sqlx::query(
        r#"
        UPDATE projects 
        SET git_remote_url = ?, git_branch = ?, git_commit = ?, git_dirty = ?, updated_at = ?
        WHERE id = ?
        "#,
    )
    .bind(&git_info.remote_url)
    .bind(&git_info.current_branch)
    .bind(&git_info.commit_hash)
    .bind(git_info.has_uncommitted_changes)
    .bind(&now)
    .bind(&project_id)
    .execute(&pool)
    .await
    .map_err(|e| e.to_string())?;
    
    Ok(git_info)
}

#[tauri::command]
pub async fn environment_create_cmd(app: tauri::AppHandle, input: CreateEnvironmentInput) -> Result<ProjectEnvironment, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_create(&pool, input).await
}

#[tauri::command]
pub async fn environment_get_cmd(app: tauri::AppHandle, id: String) -> Result<Option<ProjectEnvironment>, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_get(&pool, &id).await
}

#[tauri::command]
pub async fn environment_list_cmd(app: tauri::AppHandle, project_id: Option<String>) -> Result<Vec<ProjectEnvironment>, String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_list(&pool, project_id.as_deref()).await
}

#[tauri::command]
pub async fn environment_update_state_cmd(app: tauri::AppHandle, id: String, state: String, error: Option<String>) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_update_state(&pool, &id, &state, error).await
}

#[tauri::command]
pub async fn environment_update_container_id_cmd(app: tauri::AppHandle, id: String, container_id: String) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_update_container_id(&pool, &id, &container_id).await
}

#[tauri::command]
pub async fn environment_update_ports_cmd(app: tauri::AppHandle, id: String, ports_json: String) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_update_ports(&pool, &id, &ports_json).await
}

#[tauri::command]
pub async fn environment_delete_cmd(app: tauri::AppHandle, id: String) -> Result<(), String> {
    let pool = init_db(&app).await.map_err(|e| e.to_string())?;
    environment_delete(&pool, &id).await
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct GitInfo {
    pub remote_url: Option<String>,
    pub current_branch: Option<String>,
    pub commit_hash: Option<String>,
    pub has_uncommitted_changes: bool,
}

async fn get_git_remote_url(path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["config", "--get", "remote.origin.url"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("No remote URL".to_string())
    }
}

async fn get_git_current_branch(path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["rev-parse", "--abbrev-ref", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("No branch".to_string())
    }
}

async fn get_git_commit_hash(path: &str) -> Result<String, String> {
    let output = Command::new("git")
        .args(["rev-parse", "HEAD"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;
    
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        Err("No commit".to_string())
    }
}

async fn get_git_has_uncommitted_changes(path: &str) -> Result<bool, String> {
    let output = Command::new("git")
        .args(["status", "--porcelain"])
        .current_dir(path)
        .output()
        .map_err(|e| e.to_string())?;
    
    Ok(!String::from_utf8_lossy(&output.stdout).trim().is_empty())
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::SqlitePool;

    async fn test_pool() -> SqlitePool {
        let pool = SqlitePool::connect("sqlite::memory:").await.unwrap();
        sqlx::migrate!("./migrations").run(&pool).await.unwrap();
        pool
    }

    #[tokio::test]
    async fn test_project_crud() {
        std::env::set_var("HOME", "/tmp");
        let temp_dir = std::env::temp_dir();
        std::fs::create_dir_all(format!("{}/test-project", temp_dir.display())).unwrap();
        
        let pool = test_pool().await;
        
        // Create
        let project = project_create(&pool, CreateProjectInput {
            path: format!("{}/test-project", temp_dir.display()).to_string(),
            name: Some("Test Project".to_string()),
        }).await.unwrap();
        assert_eq!(project.name, "Test Project");

        // Get
        let fetched = project_get(&pool, &project.id).await.unwrap().unwrap();
        assert_eq!(fetched.id, project.id);

        // List
        let list = project_list(&pool).await.unwrap();
        assert_eq!(list.len(), 1);

        // Delete
        project_delete(&pool, &project.id).await.unwrap();
        let deleted = project_get(&pool, &project.id).await.unwrap();
        assert!(deleted.is_none());
    }
}