import cors from 'cors';
import express, { RequestHandler, Request } from 'express';
import type { Database } from 'sqlite';
import { handleError } from './handle-error.js';
import { z, ZodSchema } from 'zod';
import { CreateTaskSchema, TaskSchema, UpdateTaskSchema } from 'busy-bee-schema';

export async function createServer(database: Database) {
  const app = express();
  app.use(cors());
  app.use(express.json());

  const incompleteTasks = await database.prepare('SELECT * FROM tasks whERE completed = 0');
  const completedTasks = await database.prepare('SELECT * FROM tasks WHERE completed = 1');
  const getTask = await database.prepare('SELECT * FROM tasks WHERE id = ?');
  const createTask = await database.prepare('INSERT INTO tasks (title, description) VALUES (?, ?)');
  const deleteTask = await database.prepare('DELETE FROM tasks WHERE id = ?');
  const updateTask = await database.prepare(
    `UPDATE tasks SET title = ?, description = ?, completed = ? WHERE id = ?`,
  );

  const validateBody =
    <T>(schema: ZodSchema<T>): RequestHandler<NonNullable<unknown>, unknown, T> =>
    (req, res, next) => {
      try {
        schema.parse(req.body);
        next();
      } catch (e) {
        return handleError(req, res, e);
      }
    };

  const validateQueryParams =
    <T>(
      schema: ZodSchema<T>,
    ): RequestHandler<NonNullable<unknown>, unknown, unknown, Request['query'] & T> =>
    (req, res, next) => {
      try {
        schema.parse(req.query);
        next();
      } catch (e) {
        return handleError(req, res, e);
      }
    };

  const validateParams =
    <T>(schema: ZodSchema<T>): RequestHandler<T> =>
    (req, res, next) => {
      try {
        schema.parse(req.params);
        next();
      } catch (e) {
        return handleError(req, res, e);
      }
    };

  app.get(
    '/tasks',
    validateQueryParams(z.object({ completed: z.coerce.boolean() })),
    async (req, res) => {
      const { completed } = req.query;
      const query = completed ? completedTasks : incompleteTasks;

      try {
        const tasks = await query.all();
        return res.json(tasks);
      } catch (error) {
        return handleError(req, res, error);
      }
    },
  );

  // Get a specific task
  app.get('/tasks/:id', validateParams(z.object({ id: z.coerce.number() })), async (req, res) => {
    try {
      const { id } = req.params;
      const task = await getTask.get([id]);

      if (!task) return res.status(404).json({ message: 'Task not found' });

      return res.json(task);
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  app.post('/tasks', validateBody(CreateTaskSchema), async (req, res) => {
    try {
      const { title, description } = req.body;

      await createTask.run([title, description]);
      return res.status(201).json({ message: 'Task created successfully!' });
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  // Update a task
  app.put('/tasks/:id', async (req, res) => {
    try {
      const { id } = z.object({ id: z.coerce.number() }).parse(req.params);

      const previous = TaskSchema.parse(await getTask.get([id]));
      const updates = UpdateTaskSchema.parse(req.body);
      const task = { ...previous, ...updates };

      await updateTask.run([task.title, task.description, task.completed, id]);
      return res.status(200).json({ message: 'Task updated successfully' });
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  // Delete a task
  app.delete('/tasks/:id', async (req, res) => {
    try {
      const { id } = req.params;
      await deleteTask.run([id]);
      return res.status(200).json({ message: 'Task deleted successfully' });
    } catch (error) {
      return handleError(req, res, error);
    }
  });

  return app;
}
