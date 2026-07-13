from io import BytesIO

import matplotlib

# Report generation runs in containers and CI without a display server.
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np

from app.schemas import ReportRequest


class ChartGenerator:
    FIGSIZE = (12, 6.2)
    DPI = 180
    COLORS = (
        "#2563EB",
        "#0F766E",
        "#D97706",
        "#7C3AED",
        "#DC2626",
        "#0891B2",
        "#4D7C0F",
        "#DB2777",
        "#475569",
        "#9333EA",
    )

    def generate(self, report: ReportRequest) -> bytes:
        fig, ax = plt.subplots(figsize=self.FIGSIZE, facecolor="white")
        ax.set_facecolor("#F8FAFC")

        for index, sensor in enumerate(report.sensors):
            if len(sensor.values) != len(report.timestamps):
                raise ValueError(f"Sensor {sensor.id} has invalid number of points.")

            delta = np.asarray(sensor.values, dtype=float) - sensor.initial

            ax.plot(
                report.timestamps,
                delta,
                color=self.COLORS[index % len(self.COLORS)],
                label=sensor.name,
                linewidth=1.8,
                alpha=0.95,
            )

        ax.set_xlabel("Time, s", color="#475569", labelpad=10, fontsize=10)
        ax.set_ylabel("Δ frequency, Hz", color="#475569", labelpad=10, fontsize=10)
        ax.axhline(0, color="#94A3B8", linestyle="--", linewidth=0.9, zorder=0)
        ax.grid(axis="y", color="#CBD5E1", linewidth=0.7, alpha=0.7)
        ax.grid(axis="x", visible=False)
        ax.tick_params(axis="both", colors="#64748B", labelsize=9, length=0)

        for spine in ax.spines.values():
            spine.set_visible(False)

        if report.sensors:
            columns = min(4, len(report.sensors))
            legend = ax.legend(
                loc="lower center",
                bbox_to_anchor=(0.5, 1.01),
                ncol=columns,
                frameon=False,
                fontsize=9,
                handlelength=2.4,
                columnspacing=1.6,
            )
            for text in legend.get_texts():
                text.set_color("#334155")

        fig.subplots_adjust(left=0.085, right=0.985, bottom=0.14, top=0.84)

        buffer = BytesIO()
        fig.savefig(
            buffer,
            format="png",
            dpi=self.DPI,
            facecolor=fig.get_facecolor(),
        )
        plt.close(fig)

        buffer.seek(0)
        return buffer.getvalue()
