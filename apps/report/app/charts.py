from io import BytesIO

import matplotlib

# Report generation runs in containers and CI without a display server.
matplotlib.use("Agg")

import matplotlib.pyplot as plt
import numpy as np

from app.features import calculate_features
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

    def generate_radar(self, report: ReportRequest) -> bytes:
        """Render the legacy MAG-soft maximum-response diagram.

        Each axis represents a sensor and its radius is the absolute frequency
        shift at that sensor's extremum (the ``max_abs`` report feature).
        """
        labels = [sensor.name for sensor in report.sensors]
        values = [
            calculate_features(report.timestamps, sensor.initial, sensor.values).get(
                "max_abs", 0.0
            )
            for sensor in report.sensors
        ]

        fig = plt.figure(figsize=(7.2, 6.2), facecolor="white")
        ax = fig.add_subplot(111, polar=True)
        ax.set_facecolor("#F8FAFC")

        if labels:
            angles = np.linspace(0, 2 * np.pi, len(labels), endpoint=False)
            closed_angles = np.append(angles, angles[0])
            closed_values = np.append(values, values[0])
            upper_limit = max(values) * 1.15 if max(values) > 0 else 1.0

            ax.plot(
                closed_angles,
                closed_values,
                color="#2563EB",
                linewidth=2.2,
                marker="o",
                markersize=4.5,
                markerfacecolor="#0F766E",
                markeredgecolor="white",
                markeredgewidth=1,
            )
            ax.fill(closed_angles, closed_values, color="#2563EB", alpha=0.16)
            axis_labels = [
                f"{label}\n{value:,.2f} Hz" for label, value in zip(labels, values)
            ]
            ax.set_xticks(angles)
            ax.set_xticklabels(axis_labels, color="#334155", fontsize=9)
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
        ax.grid(color="#CBD5E1", linewidth=0.7, alpha=0.85)
        ax.spines["polar"].set_color("#DCE4EE")
        ax.spines["polar"].set_linewidth(0.8)
        ax.tick_params(axis="x", pad=11)
        ax.tick_params(axis="y", colors="#64748B", labelsize=8)
        ax.set_rlabel_position(18)
        ax.set_title(
            "Peak response by sensor, Hz",
            color="#0F172A",
            fontsize=12,
            fontweight="bold",
            pad=18,
        )

        fig.subplots_adjust(left=0.13, right=0.87, bottom=0.13, top=0.84)
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
