use anyhow::{Result, Context};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectConfig {
    pub project: ProjectSection,
    #[serde(default)]
    pub build: BuildSection,
    #[serde(default)]
    pub simulation: SimulationSection,
    #[serde(default)]
    pub devices: DevicesSection,
    #[serde(default)]
    pub timing: TimingSection,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectSection {
    pub name: String,
    #[serde(default = "default_version")]
    pub version: String,
    #[serde(default = "default_vhdl_std")]
    pub vhdl_std: String,
    #[serde(default = "default_work_dir")]
    pub work_dir: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuildSection {
    #[serde(default = "default_sources")]
    pub sources: Vec<String>,
    #[serde(default)]
    pub top_entity: Option<String>,
    #[serde(default = "default_vhdl_std")]
    pub vhdl_std: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulationSection {
    #[serde(default = "default_duration")]
    pub duration_ns: u64,
    #[serde(default = "default_wave_format")]
    pub wave_format: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DevicesSection {
    #[serde(default)]
    pub target: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TimingSection {
    #[serde(default)]
    pub constraints: Vec<String>,
}

impl Default for BuildSection {
    fn default() -> Self {
        Self {
            sources: default_sources(),
            top_entity: None,
            vhdl_std: default_vhdl_std(),
        }
    }
}

impl Default for SimulationSection {
    fn default() -> Self {
        Self {
            duration_ns: default_duration(),
            wave_format: default_wave_format(),
        }
    }
}

impl Default for DevicesSection {
    fn default() -> Self {
        Self { target: String::new() }
    }
}

impl Default for TimingSection {
    fn default() -> Self {
        Self { constraints: vec![] }
    }
}

impl ProjectConfig {
    pub fn work_dir(&self) -> PathBuf {
        self.project.work_dir()
    }
}

impl ProjectSection {
    pub fn work_dir(&self) -> PathBuf {
        self.work_dir
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| PathBuf::from(".chronam"))
    }
}

fn default_version() -> String {
    "0.1.0".into()
}

fn default_vhdl_std() -> String {
    "2008".into()
}

fn default_work_dir() -> Option<String> {
    None
}

fn default_sources() -> Vec<String> {
    vec!["src/**/*.vhd".into(), "src/**/*.vhdl".into()]
}

fn default_duration() -> u64 {
    1000
}

fn default_wave_format() -> String {
    "vcd".into()
}

/// Load project configuration from chronam.toml.
/// If no path is given, searches the current directory and parents.
pub fn load_config(path: Option<&str>) -> Result<ProjectConfig> {
    let config_path = if let Some(p) = path {
        PathBuf::from(p)
    } else {
        find_project_config()?
    };

    let content = std::fs::read_to_string(&config_path)
        .with_context(|| format!("Failed to read {}", config_path.display()))?;

    let config: ProjectConfig = toml::from_str(&content)
        .with_context(|| format!("Failed to parse {}", config_path.display()))?;

    Ok(config)
}

fn find_project_config() -> Result<PathBuf> {
    let cwd = std::env::current_dir()
        .context("Cannot determine current directory")?;

    let mut dir = Some(cwd.as_path());
    while let Some(d) = dir {
        let candidate = d.join("chronam.toml");
        if candidate.exists() {
            return Ok(candidate);
        }
        dir = d.parent();
    }

    // Return default config when no project file found
    let config = ProjectConfig {
        project: ProjectSection {
            name: "unnamed".into(),
            version: default_version(),
            vhdl_std: default_vhdl_std(),
            work_dir: None,
        },
        build: BuildSection::default(),
        simulation: SimulationSection::default(),
        devices: DevicesSection::default(),
        timing: TimingSection::default(),
    };
    // Write it
    let toml_str = toml::to_string_pretty(&config)?;
    let path = cwd.join("chronam.toml");
    std::fs::write(&path, &toml_str)?;
    eprintln!("{} Created default chronam.toml", "[chronam]".dimmed());
    Ok(path)
}

/// Resolve glob patterns to actual file paths
pub fn resolve_sources(patterns: &[String]) -> Result<Vec<PathBuf>> {
    let mut files: Vec<PathBuf> = Vec::new();
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

    for pattern in patterns {
        let entries = glob::glob(pattern)
            .with_context(|| format!("Invalid glob pattern '{}'", pattern))?;

        for entry in entries {
            match entry {
                Ok(path) => {
                    if seen.insert(path.clone()) {
                        files.push(path);
                    }
                }
                Err(e) => {
                    eprintln!("  {} {}", "[warn]".yellow().bold(), e);
                }
            }
        }
    }

    files.sort();
    Ok(files)
}

use colored::Colorize;
