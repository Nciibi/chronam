use anyhow::{Context, Result};
use clap::Args;
use std::fs;
use std::path::Path;
use crate::cli::Cli;
use crate::output::{error_, highlight, step, success};

#[derive(Args, Debug)]
pub struct GenArgs {
    pub file: String,
}

pub fn run(vhdl_path: &str, _cli: &Cli) -> Result<()> {
    let path = Path::new(vhdl_path);
    if !path.exists() {
        error_(&format!("File not found: {}", vhdl_path));
        return Ok(());
    }

    let content = fs::read_to_string(path)
        .with_context(|| format!("Failed to read {}", vhdl_path))?;

    let entity = match extract_entity(&content) {
        Some(e) => e,
        None => {
            error_("Could not find an entity declaration in the file");
            return Ok(());
        }
    };

    let ports = extract_ports(&content);

    let project_name = entity.to_lowercase();
    let dir_name = format!("{}_sim", project_name);
    let out_dir = Path::new(&dir_name);
    fs::create_dir_all(out_dir).with_context(|| format!("Failed to create {}", out_dir.display()))?;

    let tb_filename = format!("testbench_{}.vhdl", project_name);
    let tb_path = out_dir.join(&tb_filename);

    let tb_src = generate_testbench(&entity, &ports);

    step("gen", &format!("Entity: {}", highlight(&entity)));
    if ports.is_empty() {
        step("gen", "No ports found (entity may be a top-level testbench itself)");
    } else {
        step("gen", &format!("{} port{}", ports.len(), if ports.len() == 1 { "" } else { "s" }));
    }
    step("gen", &format!("Output: {}", highlight(&tb_path.display().to_string())));

    fs::write(&tb_path, tb_src)
        .with_context(|| format!("Failed to write {}", tb_path.display()))?;

    success("gen", "Testbench generated");
    println!();
    println!("  Next steps:");
    println!("    1. Edit {} to add your stimulus", tb_path.display());
    println!("    2. Run: chronam --run-sim {}", tb_path.display());

    Ok(())
}

fn extract_entity(content: &str) -> Option<String> {
    let re = regex_lite::Regex::new(
        r"(?is)\bentity\s+(\w+)\s+is\b"
    ).ok()?;
    re.captures(content).map(|c| c[1].to_string())
}

fn extract_ports(content: &str) -> Vec<Port> {
    let mut ports = Vec::new();

    // Find the port block with proper parenthesis depth tracking
    let port_start = match find_port_block_start(content) {
        Some(s) => s,
        None => return ports,
    };
    let block = match extract_block(content, port_start) {
        Some(b) => b,
        None => return ports,
    };

    let mut buf = String::new();
    let mut depth = 0u32;
    for ch in block.chars() {
        match ch {
            '(' => depth += 1,
            ')' if depth > 0 => depth -= 1,
            _ => {}
        }
        if ch == ';' && depth == 0 {
            if let Some(p) = parse_port_line(&buf) {
                ports.push(p);
            }
            buf.clear();
        } else {
            buf.push(ch);
        }
    }
    if !buf.trim().is_empty() {
        if let Some(p) = parse_port_line(&buf) {
            ports.push(p);
        }
    }

    ports
}

fn find_port_block_start(content: &str) -> Option<usize> {
    let re = regex_lite::Regex::new(r"(?is)\bport\s*\(").ok()?;
    re.captures(content).and_then(|c| {
        let m = c.get(0)?;
        Some(m.end() - 1) // position of the '('
    })
}

fn extract_block(content: &str, open_paren: usize) -> Option<String> {
    let chars: Vec<char> = content.chars().collect();
    if open_paren >= chars.len() || chars[open_paren] != '(' {
        return None;
    }
    let mut depth = 0u32;
    let mut end = open_paren;
    for (i, &ch) in chars.iter().enumerate().skip(open_paren) {
        match ch {
            '(' => depth += 1,
            ')' => {
                depth -= 1;
                if depth == 0 {
                    end = i;
                    break;
                }
            }
            _ => {}
        }
    }
    if depth != 0 {
        return None;
    }
    Some(content[open_paren + 1..end].to_string())
}

#[derive(Debug)]
struct Port {
    name: String,
    direction: String,
    sig_type: String,
}

fn parse_port_line(line: &str) -> Option<Port> {
    let re = regex_lite::Regex::new(
        r"(?is)^\s*(\w+)\s*:\s*(in|out|inout|buffer)\s+(.+?)\s*$"
    ).ok()?;
    let caps = re.captures(line.trim())?;
    Some(Port {
        name: caps[1].to_string(),
        direction: caps[2].to_string().to_lowercase(),
        sig_type: caps[3].to_string(),
    })
}

fn generate_testbench(entity: &str, ports: &[Port]) -> String {
    let clk_name = ports.iter()
        .find(|p| p.name.to_lowercase().contains("clk"))
        .map(|p| p.name.as_str())
        .unwrap_or("clk");
    let rst_name = ports.iter()
        .find(|p| {
            let n = p.name.to_lowercase();
            n.contains("rst") || n.contains("reset")
        })
        .map(|p| p.name.as_str())
        .unwrap_or("reset");
    let has_clk = ports.iter().any(|p| p.name.to_lowercase().contains("clk"));
    let has_rst = ports.iter().any(|p| {
        let n = p.name.to_lowercase();
        n.contains("rst") || n.contains("reset")
    });

    let mut tb = String::new();

    tb.push_str("-- modify this file for simulation\n");
    tb.push_str("-- Auto-generated testbench for ");
    tb.push_str(entity);
    tb.push('\n');
    tb.push('\n');

    tb.push_str("library ieee;\n");
    tb.push_str("use ieee.std_logic_1164.all;\n");
    tb.push_str("use ieee.numeric_std.all;\n");
    tb.push('\n');

    tb.push_str(&format!("entity testbench_{} is\n", entity.to_lowercase()));
    tb.push_str("end entity;\n");
    tb.push('\n');

    tb.push_str(&format!("architecture sim of testbench_{} is\n", entity.to_lowercase()));

    tb.push('\n');
    tb.push_str(&format!("  component {} is\n", entity));
    if ports.is_empty() {
        tb.push_str("  end component;\n");
    } else {
        tb.push_str("    port (\n");
        for (i, p) in ports.iter().enumerate() {
            let comma = if i == ports.len() - 1 { "" } else { ";" };
            tb.push_str(&format!("      {} : {} {}{}\n", p.name, p.direction.to_uppercase(), p.sig_type, comma));
        }
        tb.push_str("    );\n");
        tb.push_str("  end component;\n");
    }

    tb.push('\n');

    tb.push_str("  -- Component signals\n");
    for p in ports {
        tb.push_str(&format!("  signal {} : {};\n", p.name, p.sig_type));
    }

    tb.push('\n');
    tb.push_str("  -- Clock period constant\n");
    tb.push_str("  constant CLK_PERIOD : time := 10 ns;\n");
    tb.push('\n');
    tb.push_str("begin\n");
    tb.push('\n');

    if has_clk {
        tb.push_str("  -- Clock generator\n");
        tb.push_str("  clk_process : process\n");
        tb.push_str("  begin\n");
        tb.push_str("    while true loop\n");
        tb.push_str("      clk <= '0';\n");
        tb.push_str("      wait for CLK_PERIOD / 2;\n");
        tb.push_str("      clk <= '1';\n");
        tb.push_str("      wait for CLK_PERIOD / 2;\n");
        tb.push_str("    end loop;\n");
        tb.push_str("  end process;\n");
        tb.push('\n');
    }

    if has_rst {
        tb.push_str("  -- Reset stimulus\n");
        tb.push_str("  reset_process : process\n");
        tb.push_str("  begin\n");
        tb.push_str("    reset <= '1';\n");
        tb.push_str("    wait for 100 ns;\n");
        tb.push_str("    reset <= '0';\n");
        tb.push_str("    wait;\n");
        tb.push_str("  end process;\n");
        tb.push('\n');
    }

    tb.push_str("  -- Stimulus process\n");
    tb.push_str("  stimulus : process\n");
    tb.push_str("  begin\n");
    tb.push_str("    -- Initialize inputs\n");
    for p in ports {
        if p.direction == "in" || p.direction == "inout" {
            let init = if p.sig_type.to_lowercase().contains("std_logic") && !p.sig_type.to_lowercase().contains("vector") {
                "'0'"
            } else {
                "(others => '0')"
            };
            tb.push_str(&format!("    {} <= {};\n", p.name, init));
        }
    }
    tb.push('\n');
    tb.push_str("    wait for 100 ns;\n");
    tb.push('\n');
    tb.push_str("    -- Add your stimulus here\n");
    for p in ports {
        if p.direction == "in" || p.direction == "inout" {
            if p.sig_type.to_lowercase().contains("std_logic") && !p.sig_type.to_lowercase().contains("vector") {
                tb.push_str(&format!("    -- {} <= '1';\n", p.name));
            } else {
                tb.push_str(&format!("    -- {} <= x\"AA\";\n", p.name));
            }
        }
    }
    tb.push('\n');
    tb.push_str("    wait;\n");
    tb.push_str("  end process;\n");
    tb.push('\n');

    tb.push_str(&format!("  -- Instantiate the design under test\n"));
    tb.push_str(&format!("  uut : {} \n", entity));
    if ports.is_empty() {
        tb.push_str("    port map ();\n");
    } else {
        tb.push_str("    port map (\n");
        for (i, p) in ports.iter().enumerate() {
            let comma = if i == ports.len() - 1 { "" } else { "," };
            tb.push_str(&format!("      {} => {}{}\n", p.name, p.name, comma));
        }
        tb.push_str("    );\n");
    }

    tb.push_str("end architecture;\n");

    tb
}
