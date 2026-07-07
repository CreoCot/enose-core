import numpy as np


def calculate_features(
    timestamps: list[float],
    initial: float,
    values: list[float],
) -> dict[str, float]:

    t = np.asarray(timestamps, dtype=float)
    delta = np.asarray(values, dtype=float) - initial

    mask = t >= 0
    t = t[mask]
    delta = delta[mask]

    if len(delta) == 0:
        return {}

    i_max = int(np.argmax(np.abs(delta)))

    auc = float(
        np.trapezoid(delta, t) if hasattr(np, "trapezoid") else np.trapz(delta, t)
    )

    end_value = float(delta[-1])
    max_signed = float(delta[i_max])

    n0 = max(2, len(delta) // 10)

    slope_init = float((delta[n0 - 1] - delta[0]) / (t[n0 - 1] - t[0] + 1e-9))

    return {
        "max_abs": float(np.max(np.abs(delta))),
        "max_signed": max_signed,
        "time_to_max": float(t[i_max]),
        "end_value": end_value,
        "auc": auc,
        "slope_init": slope_init,
        "drop_from_max": float(max_signed - end_value),
        "noise_std": float(np.std(np.diff(delta))),
    }
