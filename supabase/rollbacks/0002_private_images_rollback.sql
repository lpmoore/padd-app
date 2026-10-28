-- Undo for 0002: re-opens the bucket. Run only as an emergency step.
-- Records keep their bare paths (the new app reads both forms). The OLD app
-- cannot display bare paths, so roll the app back as well if you use this.
update storage.buckets set public = true where id = 'task-images';
