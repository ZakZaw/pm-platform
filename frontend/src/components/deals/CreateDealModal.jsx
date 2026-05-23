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
import { salesApi } from '@/api/sales.api';

export function CreateDealModal({ projectId, stages, onClose, onCreated }) {
  const toast = useToast();
  const [accounts, setAccounts] = useState([]);
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [accountId, setAccountId] = useState('');
  const [stageId, setStageId] = useState(
    stages.find((s) => !s.isTerminalWon && !s.isTerminalLost)?.id ?? '',
  );
  const [newAccountName, setNewAccountName] = useState('');
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    salesApi.listAccounts(projectId).then((rows) => {
      if (cancelled) return;
      setAccounts(rows);
      if (rows.length > 0 && !accountId) setAccountId(rows[0].id);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [projectId, accountId]);

  async function createInlineAccount() {
    if (!newAccountName.trim()) return;
    setCreatingAccount(true);
    try {
      const created = await salesApi.createAccount(projectId, { name: newAccountName.trim() });
      setAccounts([created, ...accounts]);
      setAccountId(created.id);
      setNewAccountName('');
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create account.');
    } finally {
      setCreatingAccount(false);
    }
  }

  async function submit(e) {
    e.preventDefault();
    setError(null);
    if (name.trim().length < 1) return;
    if (!accountId) {
      setError('Pick or create an account first.');
      return;
    }
    const valueNum = Number(value || 0);
    if (Number.isNaN(valueNum) || valueNum < 0) {
      setError('Value must be 0 or greater.');
      return;
    }
    setSubmitting(true);
    try {
      await salesApi.createDeal(projectId, {
        name: name.trim(),
        accountId,
        value: valueNum,
        currency: currency.trim().toUpperCase(),
        stageId: stageId || undefined,
      });
      onCreated?.();
    } catch (err) {
      setError(err.response?.data?.detail ?? 'Could not create deal.');
      toast.show({ tone: 'danger', message: err.response?.data?.detail ?? 'Could not create deal.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal open onClose={onClose} labelledBy="create-deal-title" size="md">
      <form onSubmit={submit}>
        <ModalHeader>
          <h2 id="create-deal-title" style={{ margin: 0, fontSize: 16 }}>New deal</h2>
        </ModalHeader>
        <ModalBody>
          <div className="vstack" style={{ gap: 12 }}>
            <Input
              label="Deal name"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Acme Corp — Enterprise plan"
              required
            />
            <div className="grid-2" style={{ gap: 12 }}>
              <Input
                label="Value"
                type="number"
                min={0}
                step="0.01"
                value={value}
                onChange={(e) => setValue(e.target.value)}
              />
              <Input
                label="Currency"
                value={currency}
                onChange={(e) => setCurrency(e.target.value.toUpperCase())}
                maxLength={3}
              />
            </div>
            <Select
              label="Account"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              options={accounts.map((a) => ({ value: a.id, label: a.name }))}
            />
            <div className="hstack" style={{ gap: 6 }}>
              <Input
                value={newAccountName}
                onChange={(e) => setNewAccountName(e.target.value)}
                placeholder="…or create a new account"
              />
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={creatingAccount || !newAccountName.trim()}
                onClick={createInlineAccount}
              >
                {creatingAccount ? 'Creating…' : 'Add'}
              </Button>
            </div>
            <Select
              label="Stage"
              value={stageId}
              onChange={(e) => setStageId(e.target.value)}
              options={stages
                .filter((s) => !s.isTerminalWon && !s.isTerminalLost)
                .map((s) => ({ value: s.id, label: s.name }))}
            />
            {error && <p style={{ color: 'var(--danger)', margin: 0 }}>{error}</p>}
          </div>
        </ModalBody>
        <ModalFooter>
          <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={submitting || !accountId || name.trim().length < 1}>
            {submitting ? 'Creating…' : 'Create deal'}
          </Button>
        </ModalFooter>
      </form>
    </Modal>
  );
}
