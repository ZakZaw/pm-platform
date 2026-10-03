import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Select,
  useToast,
} from '@/components/ui';
import { supportApi } from '@/api/support.api';

export function CreateTicketModal({ projectId, queues, onClose, onCreated }) {
  const toast = useToast();
  const [customers, setCustomers] = useState([]);
  const [customerId, setCustomerId] = useState('');
  const [newCustomerName, setNewCustomerName] = useState('');
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [subject, setSubject] = useState('');
  const [bodyMd, setBodyMd] = useState('');
  const [queueId, setQueueId] = useState(queues[0]?.id ?? '');
  const [priority, setPriority] = useState('Medium');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    supportApi.listCustomers(projectId).then((rows) => {
      if (cancelled) return;
      setCustomers(rows);
      if (rows.length > 0 && !customerId) setCustomerId(rows[0].id);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, customerId]);

  async function createCustomer() {
    if (!newCustomerName.trim()) return;
    setCreatingCustomer(true);
    try {
      const created = await supportApi.createCustomer(projectId, { name: newCustomerName.trim() });
      setCustomers([created, ...customers]);
      setCustomerId(created.id);
      setNewCustomerName('');
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create customer.');
    } finally {
      setCreatingCustomer(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (!subject.trim()) return;
    if (!customerId) {
      setError('Pick or create a customer first.');
      return;
    }
    setBusy(true);
    try {
      await supportApi.createTicket(projectId, {
        customerId,
        queueId: queueId || undefined,
        subject: subject.trim(),
        bodyMd: bodyMd.trim() || undefined,
        priority,
      });
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create ticket.');
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not create ticket.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="create-ticket-title" size="md">
      <form onSubmit={submit}>
        <ModalHeader>
          <h2 id="create-ticket-title" className="modal-title">New ticket</h2>
        </ModalHeader>
        <ModalBody>
          <div className="col gap-5">
            <Select
              label="Customer"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              options={customers.map((c) => ({
                value: c.id,
                label: c.tier ? `${c.name} · ${c.tier}` : c.name,
              }))}
            />
            <div className="row gap-3">
              <div className="fill">
                <Input
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="…or create a new customer"
                  aria-label="Or create a new customer"
                />
              </div>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={creatingCustomer || !newCustomerName.trim()}
                onClick={createCustomer}
              >
                {creatingCustomer ? 'Creating…' : 'Add'}
              </Button>
            </div>

            <Input
              label="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              required
              autoFocus
            />
            <div>
              <label className="input-label" htmlFor="create-ticket-body">Description</label>
              <textarea
                id="create-ticket-body"
                className="textarea"
                rows={4}
                value={bodyMd}
                onChange={(e) => setBodyMd(e.target.value)}
                placeholder="What's the customer reporting?"
              />
            </div>
            <div className="grid-2">
              <Select
                label="Queue"
                value={queueId}
                onChange={(e) => setQueueId(e.target.value)}
                options={queues.map((q) => ({ value: q.id, label: q.name }))}
              />
              <Select
                label="Priority"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                options={[
                  { value: 'Urgent', label: 'Urgent' },
                  { value: 'High', label: 'High' },
                  { value: 'Medium', label: 'Medium' },
                  { value: 'Low', label: 'Low' },
                ]}
              />
            </div>
            {error && <p className="input-help is-error">{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !subject.trim() || !customerId}>
            {busy ? 'Creating…' : 'Create ticket'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
