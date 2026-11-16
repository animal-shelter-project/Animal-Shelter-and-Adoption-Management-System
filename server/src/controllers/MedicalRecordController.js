const db = require('../db');
const MedicalRecord = require('../models/MedicalRecord');

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value;
}

function listForAnimal(req, res) {
  const animalId = Number(req.params.id);

  if (!Number.isInteger(animalId) || animalId < 1) {
    return res.status(400).json({ error: 'Invalid animal ID.' });
  }

  const animal = db.prepare('SELECT id FROM animals WHERE id = ?').get(animalId);

  if (!animal) {
    return res.status(404).json({ error: 'Animal not found.' });
  }

  return res.json(MedicalRecord.findByAnimalId(animalId));
}

function createForAnimal(req, res) {
  const animalId = Number(req.params.id);

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  const { recordDate, recordType, notes = '' } = req.body;

  if (!Number.isInteger(animalId) || animalId < 1) {
    return res.status(400).json({ error: 'Invalid animal ID.' });
  }

  const animal = db.prepare('SELECT id FROM animals WHERE id = ?').get(animalId);

  if (!animal) {
    return res.status(404).json({ error: 'Animal not found.' });
  }

  if (!isValidDate(recordDate)) {
    return res.status(400).json({
      error: 'recordDate must be a valid date in YYYY-MM-DD format.'
    });
  }

  if (typeof recordType !== 'string' || !recordType.trim()) {
    return res.status(400).json({ error: 'recordType is required.' });
  }

  if (typeof notes !== 'string') {
    return res.status(400).json({ error: 'notes must be text.' });
  }

  const record = MedicalRecord.create({
    animalId,
    recordDate,
    recordType: recordType.trim(),
    notes: notes.trim()
  });

  return res.status(201).json(record);
}

// Finds the record named in the URL and checks it belongs to that animal.
// Returns the record, or sends the error response and returns null.
function findRecordForAnimal(req, res) {
  const animalId = Number(req.params.id);
  const recordId = Number(req.params.recordId);

  if (!Number.isInteger(animalId) || animalId < 1) {
    res.status(400).json({ error: 'Invalid animal ID.' });
    return null;
  }

  if (!Number.isInteger(recordId) || recordId < 1) {
    res.status(400).json({ error: 'Invalid record ID.' });
    return null;
  }

  const record = MedicalRecord.findById(recordId);

  if (!record || record.animalId !== animalId) {
    res.status(404).json({ error: 'Medical record not found.' });
    return null;
  }

  return record;
}

// PUT /api/animals/:id/medical-records/:recordId   (Staff only)
// Body: any of { recordDate, recordType, notes }; fields left out keep
// their current value. 200 with the updated record.
function updateForAnimal(req, res) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object.' });
  }

  const record = findRecordForAnimal(req, res);
  if (!record) return undefined;

  const {
    recordDate = record.recordDate,
    recordType = record.recordType,
    notes = record.notes
  } = req.body;

  if (!isValidDate(recordDate)) {
    return res.status(400).json({
      error: 'recordDate must be a valid date in YYYY-MM-DD format.'
    });
  }

  if (typeof recordType !== 'string' || !recordType.trim()) {
    return res.status(400).json({ error: 'recordType is required.' });
  }

  if (typeof notes !== 'string') {
    return res.status(400).json({ error: 'notes must be text.' });
  }

  return res.json(MedicalRecord.update(record.id, {
    recordDate,
    recordType: recordType.trim(),
    notes: notes.trim()
  }));
}

// DELETE /api/animals/:id/medical-records/:recordId   (Staff only)
// For a record entered by mistake. 204 when deleted.
function deleteForAnimal(req, res) {
  const record = findRecordForAnimal(req, res);
  if (!record) return undefined;

  MedicalRecord.remove(record.id);
  return res.status(204).end();
}

module.exports = {
  listForAnimal,
  createForAnimal,
  updateForAnimal,
  deleteForAnimal
};
