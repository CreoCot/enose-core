import sys
from pathlib import Path
import matplotlib.pyplot as plt
import seaborn as sns
from data_loader import load_measurement

sns.set_theme(style="whitegrid", context="talk")


def plot_measurement(xml_path: str, out_dir: Path | None = None) -> Path:
    df = load_measurement(xml_path)
    df = df[df["timestamp"] >= 0]
    name = df["name"].iloc[0]

    fig, ax = plt.subplots(figsize=(11, 6))
    sns.lineplot(
        data=df, x="timestamp", y="delta", hue="sensor_id", ax=ax, linewidth=1.6
    )
    ax.set_title(f"Sensor response — «{name}»", fontsize=18, pad=14)
    ax.set_xlabel("Time, s")
    ax.set_ylabel("Δ frequency, Hz (signal)")
    ax.axhline(0, color="grey", linewidth=0.8, linestyle="--", alpha=0.6)
    ax.legend(title="Sensor", bbox_to_anchor=(1.02, 1), loc="upper left", fontsize=11)
    fig.tight_layout()

    out_dir = out_dir or Path.cwd()
    out_path = out_dir / Path(xml_path).with_suffix(".png").name
    fig.savefig(out_path, dpi=150, bbox_inches="tight")
    plt.close(fig)
    return out_path


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print("usage: uv run python src/plot_curves.py <measurement.xml>")
        print("  try: uv run python src/plot_curves.py tests/data/sample_lemon.XML")
        raise SystemExit(1)

    saved = plot_measurement(sys.argv[1])
    print(f"Saved plot to: {saved}")
