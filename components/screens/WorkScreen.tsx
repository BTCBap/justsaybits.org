import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { WORK_DATA } from '../../constants';
import { interaction } from '../../utils/Interaction';

const WorkScreen: React.FC = () => {
  const [expanded, setExpanded] = useState<ReadonlySet<number>>(() => new Set());

  const toggle = (index: number) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
    interaction.interact('cursor', { id: `work:${index}`, source: 'pointer', haptic: 'tick' });
  };

  return (
    <div className="work-screen">
      <ol className="work-timeline">
        {WORK_DATA.map((job, index) => {
          const current = index === 0;
          const subRoles = job.subRoles ?? [];
          const hasSubRoles = subRoles.length > 0;
          const open = expanded.has(index);
          const subId = `work-subroles-${index}`;

          return (
            <li key={`${job.company}-${index}`} className={`work-item ${current ? 'work-item--current' : ''}`}>
              <span className="work-dot" aria-hidden="true" />
              <div className="work-card">
                <div className="work-head">
                  <div className="work-title">
                    <h2 className="work-company">
                      {job.company}
                    </h2>
                    <p className="work-role">
                      {job.role ?? ''}
                    </p>
                  </div>
                  <p className="work-period ps2-meta">{job.period}</p>
                </div>

                <p className="work-location ps2-meta">{job.location}</p>

                {hasSubRoles && (
                  <>
                    <button
                      type="button"
                      className="work-expand"
                      aria-expanded={open}
                      aria-controls={subId}
                      onClick={() => toggle(index)}
                      onFocus={() => interaction.interact('cursor', { id: `work:${index}`, source: 'focus' })}
                    >
                      Roles
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${open ? 'rotate-180' : ''}`}
                        aria-hidden="true"
                      />
                    </button>

                    <ol id={subId} className="work-subroles" hidden={!open}>
                      {subRoles.map((role) => (
                        <li key={`${role.title}-${role.period}`}>
                          <span className="work-subrole__title">{role.title}</span>
                          <span className="work-subrole__period ps2-meta">{role.period}</span>
                        </li>
                      ))}
                    </ol>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default WorkScreen;
