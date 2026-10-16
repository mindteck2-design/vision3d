"""Staged engineering drawing → CAD pipeline."""

__all__ = ["reconstruct"]


def __getattr__(name: str):
    if name == "reconstruct":
        from .orchestrator import reconstruct

        return reconstruct
    raise AttributeError(name)
