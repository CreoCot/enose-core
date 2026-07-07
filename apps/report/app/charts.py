from io import BytesIO

import numpy as np
import matplotlib.pyplot as plt

from app.schemas import ReportRequest


class ChartGenerator:
    FIGSIZE = (11, 6)
    DPI = 150

    def generate(self, report: ReportRequest) -> bytes:
        fig, ax = plt.subplots(figsize=self.FIGSIZE)

        for sensor in report.sensors:
            if len(sensor.values) != len(report.timestamps):
                raise ValueError(f"Sensor {sensor.id} has invalid number of points.")

            delta = np.asarray(sensor.values) - sensor.initial

            ax.plot(
                report.timestamps,
                delta,
                label=sensor.name,
                linewidth=1.5,
            )

        ax.set_title(
            f"Sensor response — {report.header.name}",
            fontsize=18,
            pad=14,
        )

        ax.set_xlabel("Time, s")
        ax.set_ylabel("Δ frequency, Hz")

        ax.axhline(
            0,
            color="gray",
            linestyle="--",
            linewidth=0.8,
            alpha=0.6,
        )

        ax.grid(True, alpha=0.3)

        ax.legend(
            title="Sensor",
            bbox_to_anchor=(1.02, 1),
            loc="upper left",
        )

        fig.tight_layout()

        buffer = BytesIO()

        fig.savefig(
            buffer,
            format="png",
            dpi=self.DPI,
            bbox_inches="tight",
        )

        plt.close(fig)

        buffer.seek(0)
        return buffer.getvalue()
