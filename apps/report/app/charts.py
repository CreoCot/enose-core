from io import BytesIO

import matplotlib

# Report generation runs in containers and CI without a display server.
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np

from app.areas import max_diagram_values, selected_deltas
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
                label=f"S{index + 1}",
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

    def generate_radar(self, report: ReportRequest) -> bytes:
        """Render the legacy MAG-soft maximum-response diagram.

        Each axis represents a sensor and its radius is the absolute frequency
        shift at that sensor's extremum (the ``max_abs`` report feature).
        """
        labels = [f"S{i + 1}" for i in range(len(report.sensors))]
        # With a mask the radii are taken at the mask points only, exactly as
        # the UI does. Without a mask this equals the previous computation,
        # because max|F0 - v| is the same as max|v - F0|.
        _, deltas = selected_deltas(report)
        values = max_diagram_values(deltas)

        # Фигура сразу в размер вставки в PDF (96 x 82.5 мм = 3.78 x 3.25 дюйма):
        # тогда pt шрифта в коде — это pt на бумаге, без пересчёта при
        # масштабировании картинки. Для статьи подписи должны быть >= 12 pt.
        fig = plt.figure(figsize=(3.78, 3.25), facecolor="white")
        ax = fig.add_subplot(111, polar=True)
        ax.set_facecolor("white")

        if labels:
            angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False)
            closed_angles = np.append(angles, angles[0])
            closed_values = np.append(values, values[0])
            upper_limit = max(values) * 1.15 if max(values) > 0 else 1.0

            # Цвет и сплошная заливка — как на диаграмме максимумов в интерфейсе
            ax.plot(
                closed_angles,
                closed_values,
                color="#4B4BC3",
                linewidth=1.4,
                marker="o",
                markersize=3.5,
                markerfacecolor="#4B4BC3",
                markeredgecolor="#4B4BC3",
            )
            ax.fill(closed_angles, closed_values, color="#4B4BC3", alpha=1.0)
            ax.set_xticks(angles)
            ax.set_xticklabels(labels, color="black", fontsize=13)
            ax.set_ylim(0, upper_limit)
        else:
            ax.set_xticks([])
            ax.set_ylim(0, 1)
            ax.text(
                0.5,
                0.5,
                "No sensor data",
                transform=ax.transAxes,
                ha="center",
                va="center",
                color="#64748B",
                fontsize=10,
            )

        ax.set_theta_zero_location("N")
        ax.set_theta_direction(-1)
        # Классический вид: белый фон, круглая сетка без заливки полос
        ax.grid(color="black", linewidth=0.5, alpha=0.3)
        ax.spines["polar"].set_color("black")
        ax.spines["polar"].set_linewidth(0.6)
        ax.tick_params(axis="x", pad=4)
        ax.tick_params(axis="y", colors="black", labelsize=12)
        ax.set_rlabel_position(22)
        ax.set_title("Peak response, Hz", color="black", fontsize=13, pad=10)

        fig.subplots_adjust(left=0.12, right=0.88, bottom=0.12, top=0.82)
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
