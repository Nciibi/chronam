use colored::Colorize;

pub fn step(label: &str, msg: &str) {
    println!(" {}  {} {}", cyan_bold(label), dim("·"), msg);
}

pub fn success(label: &str, msg: &str) {
    println!(" {}  {} {}", green_bold(label), dim("·"), msg);
}

pub fn error_(msg: &str) {
    eprintln!(" {}  {}", red_bold("error"), msg);
}

pub fn warn(msg: &str) {
    eprintln!(" {}  {}", yellow_bold("warn"), msg);
}

pub fn highlight(s: &str) -> String {
    s.cyan().to_string()
}

pub fn dim(s: &str) -> String {
    s.dimmed().to_string()
}

pub fn bold(s: &str) -> String {
    s.bold().to_string()
}

pub fn label(s: &str) -> String {
    format!("{}:", s).dimmed().to_string()
}

fn cyan_bold(s: &str) -> String {
    s.bold().cyan().to_string()
}

fn green_bold(s: &str) -> String {
    s.bold().green().to_string()
}

fn red_bold(s: &str) -> String {
    s.bold().red().to_string()
}

fn yellow_bold(s: &str) -> String {
    s.bold().yellow().to_string()
}

pub fn table(headers: &[&str], rows: &[Vec<String>]) -> String {
    use comfy_table::{Table, Cell, CellAlignment, Color};
    let mut table = Table::new();
    table.load_preset(comfy_table::presets::NOTHING);
    table.set_header(
        headers.iter().map(|h| Cell::new(h).fg(Color::DarkGrey)).collect::<Vec<_>>()
    );
    for row in rows {
        table.add_row(row.iter().map(|c| Cell::new(c)).collect::<Vec<_>>());
    }
    table.to_string()
}

pub fn progress_bar(len: u64, msg: &str) -> indicatif::ProgressBar {
    let pb = indicatif::ProgressBar::new(len);
    pb.set_style(
        indicatif::ProgressStyle::default_bar()
            .template("{spinner:.cyan} {msg} [{bar:40.cyan/blue}] {pos}/{len} ({eta})")
            .unwrap()
            .progress_chars("█▉▊▋▌▍▎▏  ")
    );
    pb.set_message(msg.to_string());
    pb
}

pub fn spinner(msg: &str) -> indicatif::ProgressBar {
    let pb = indicatif::ProgressBar::new_spinner();
    pb.set_style(
        indicatif::ProgressStyle::default_spinner()
            .template("{spinner:.cyan} {msg}")
            .unwrap()
    );
    pb.set_message(msg.to_string());
    pb
}
