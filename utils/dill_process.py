import dill
from multiprocessing import Process


class DillProcess(Process):
    # A subclass of multiprocessing.Process that uses dill for serialization
    # This allows you to use non-picklable objects in the functions passed to the Process
    # See: https://stackoverflow.com/a/72776044/7019700
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self._target = dill.dumps(self._target)  # Save the target function as bytes, using dill

    def run(self):
        if self._target:
            self._target = dill.loads(self._target)  # Unpickle the target function before executing
            self._target(*self._args, **self._kwargs)  # Execute the target function
