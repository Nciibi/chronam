use colored::Colorize;

pub fn step(label: &str, msg: &str) {
    println!(" {}  {} {}", label.bold().cyan(), "·".dimmed(), msg);
}

pub fn success(label: &str, msg: &str) {
    println!(" {}  {} {}", label.bold().green(), "·".dimmed(), msg);
}

pub fn error_(msg: &str) {
    eprintln!(" {}  {}", "error".bold().red(), msg);
}

pub fn warn(msg: &str) {
    eprintln!(" {}  {}", "warn".bold().yellow(), msg);
}

pub fn highlight(s: &str) -> String {
    s.cyan().to_string()
}

pub fn dim(s: &str) -> String {
    s.dimmed().to_string()
}

#[allow(dead_code)]
pub fn table(headers: &[&str], rows: &[Vec<String>]) -> String {
    use comfy_table::{Table, Cell, Color};
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

#[allow(dead_code)]
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

#[allow(dead_code)]
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
